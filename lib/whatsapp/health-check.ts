import { db } from '@/lib/database';
import { getPhoneNumberStatus, getWabaInfo, getSubscribedApps, verifyToken } from './meta-graph';
import type { HealthCheckResult, Blocker, Issue } from './health-types';

const SYSTEM_USER_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const META_APP_ID = process.env.META_APP_ID || process.env.NEXT_PUBLIC_APP_ID || '1599970834652215';

const REQUIRED_FIELDS_CLOUD = ['messages', 'message_template_status_update'];
const REQUIRED_FIELDS_COEX = ['messages', 'smb_message_echoes', 'message_template_status_update'];

export async function runHealthCheck(shopId: string): Promise<HealthCheckResult> {
  const critical: Blocker[] = [];
  const warnings: Blocker[] = [];
  const recoverable: Issue[] = [];

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true, metaPhoneNumberId: true, metaBusinessAccountId: true,
      metaAccessToken: true, coexistenceMode: true,
    },
  });

  if (!shop || !shop.metaPhoneNumberId || !shop.metaBusinessAccountId) {
    critical.push({
      code: 'NO_PHONE_NUMBER',
      severity: 'critical',
      message: 'Tu shop no tiene un número de WhatsApp conectado. Conéctalo desde Ajustes → WhatsApp.',
      action: { label: 'Conectar WhatsApp', url: '/dashboard/settings' },
    });
    return { canReceive: false, canSend: false, ready: false, critical, warnings, recoverable };
  }

  const token = SYSTEM_USER_TOKEN || shop.metaAccessToken || '';

  // Check 7: token validity (sistema-wide alert)
  try {
    await verifyToken(token);
  } catch {
    critical.push({
      code: 'TOKEN_INVALID',
      severity: 'critical',
      message: 'Token del sistema inválido. Contacta a soporte de DomiCita.',
    });
    return { canReceive: false, canSend: false, ready: false, critical, warnings, recoverable };
  }

  // Checks 1-2: phone status + health
  try {
    const phone = await getPhoneNumberStatus(shop.metaPhoneNumberId, token);
    if (phone.status === 'PENDING') {
      if (shop.coexistenceMode) {
        critical.push({
          code: 'PHONE_PENDING',
          severity: 'critical',
          message: 'Tu WhatsApp se está sincronizando con Meta. Esto tarda 4-6 horas la primera vez. Te avisaremos cuando esté listo.',
        });
      } else {
        critical.push({
          code: 'PHONE_NOT_REGISTERED',
          severity: 'critical',
          message: 'Tu número aún no está registrado en Cloud API. Esto se resuelve solo en unos minutos.',
        });
      }
    }
    const phoneHealth = (phone.health_status as any)?.can_send_message;
    if (phoneHealth === 'BLOCKED') {
      critical.push({
        code: 'PHONE_BLOCKED',
        severity: 'critical',
        message: 'Meta ha bloqueado tu número. Revisa el estado en Meta Business Manager.',
        action: { label: 'Abrir Meta Business Manager', url: 'https://business.facebook.com/wa/manage/phone-numbers/' },
      });
    }
  } catch {
    critical.push({
      code: 'TOKEN_INVALID',
      severity: 'critical',
      message: 'No se pudo consultar el estado de tu número en Meta.',
    });
  }

  // Checks 5-6: WABA payment + verification
  let canSend = true;
  try {
    const waba = await getWabaInfo(shop.metaBusinessAccountId, token);
    if (!waba.primary_funding_id) {
      warnings.push({
        code: 'NO_PAYMENT',
        severity: 'warning',
        message: 'Falta método de pago en tu cuenta de Meta. Sin esto, no puedes enviar mensajes proactivos (recordatorios, confirmaciones).',
        action: { label: 'Configurar método de pago', url: 'https://business.facebook.com/billing_hub/payment_settings' },
      });
      canSend = false;
    }
    if (waba.business_verification_status && waba.business_verification_status !== 'verified') {
      warnings.push({
        code: 'NOT_VERIFIED',
        severity: 'warning',
        message: 'Tu negocio aún no está verificado por Meta. Esto limita el envío de mensajes a clientes nuevos.',
        action: { label: 'Verificar negocio', url: 'https://business.facebook.com/settings/security' },
      });
    }
    const wabaHealth = waba.health_status?.can_send_message;
    if (wabaHealth === 'BLOCKED' && !warnings.some(w => w.code === 'NO_PAYMENT')) {
      warnings.push({
        code: 'WABA_BLOCKED',
        severity: 'warning',
        message: 'Meta ha limitado el envío desde tu cuenta. Revisa Meta Business Manager.',
        action: { label: 'Abrir Meta Business Manager', url: 'https://business.facebook.com/wa/manage/' },
      });
      canSend = false;
    }
  } catch {
    /* swallow — already counted via token check */
  }

  // Checks 3-4: subscribed_apps + subscribed_fields
  try {
    const apps = await getSubscribedApps(shop.metaBusinessAccountId, token);
    const ours = apps.find(a => a.whatsapp_business_api_data?.id === META_APP_ID);
    if (!ours) {
      recoverable.push({
        code: 'SUBSCRIPTION_LOST',
        message: 'La suscripción de webhook se cayó. Reparando automáticamente.',
      });
    } else {
      const required = shop.coexistenceMode ? REQUIRED_FIELDS_COEX : REQUIRED_FIELDS_CLOUD;
      const fields = ours.subscribed_fields || [];
      const missing = required.filter(f => !fields.includes(f));
      if (missing.length > 0) {
        recoverable.push({
          code: 'SUBSCRIPTION_FIELDS_INCOMPLETE',
          message: `Faltan campos: ${missing.join(', ')}. Reparando automáticamente.`,
        });
      }
    }
  } catch {
    recoverable.push({
      code: 'SUBSCRIPTION_LOST',
      message: 'No se pudo verificar la suscripción de webhook.',
    });
  }

  const canReceive = critical.length === 0 || critical.every(c => c.code === 'PHONE_PENDING');
  const ready = canReceive && critical.length === 0;

  return { canReceive, canSend: canSend && canReceive, ready, critical, warnings, recoverable };
}
