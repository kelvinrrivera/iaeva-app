/**
 * Transactional email helper using Resend.
 * All sends are fire-and-forget — errors are logged but never thrown.
 */

import { Resend } from 'resend';

const FROM = 'DomiCita <no-reply@domicita.com>';

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY is not set — email sending is disabled');
    return null;
  }
  return new Resend(apiKey);
}

export async function sendInvitationEmail(params: {
  to: string;
  inviteLink: string;
  shopName: string;
  role: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, inviteLink, shopName, role } = params;

  const roleLabel =
    role === 'ORG_ADMIN' ? 'Administrador' : 'Profesional';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#0E2A47;padding:24px 32px;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">DomiCita</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="color:#1C1F26;font-size:20px;margin:0 0 16px;">¡Te invitaron a unirte a ${shopName}!</h2>
            <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 12px;">
              Hola, te han invitado a unirte a <strong>${shopName}</strong> en DomiCita como <strong>${roleLabel}</strong>.
            </p>
            <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Haz clic en el botón de abajo para aceptar la invitación. El enlace expira en 72 horas.
            </p>
            <a href="${inviteLink}"
               style="display:inline-block;background:#A61E2E;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;font-weight:bold;">
              Aceptar invitación
            </a>
            <p style="color:#999;font-size:12px;margin:24px 0 0;">
              Si no esperabas esta invitación puedes ignorar este correo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f4;padding:16px 32px;text-align:center;">
            <p style="color:#aaa;font-size:12px;margin:0;">© ${new Date().getFullYear()} DomiCita · Todos los derechos reservados</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Invitación para unirte a ${shopName} en DomiCita`,
      html,
    });
    console.log(`[email] Invitation email sent to ${to}`);
  } catch (err) {
    console.error('[email] Failed to send invitation email:', err);
  }
}

export async function sendPaymentFailedEmail(params: {
  to: string;
  shopName: string;
  invoiceUrl?: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const { to, shopName, invoiceUrl } = params;

  const actionBlock = invoiceUrl
    ? `<a href="${invoiceUrl}"
         style="display:inline-block;background:#A61E2E;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:15px;font-weight:bold;">
        Actualizar método de pago
      </a>`
    : `<p style="color:#555;font-size:15px;">Por favor accede a tu cuenta en <a href="https://domicita.com/dashboard" style="color:#A61E2E;">DomiCita</a> para actualizar tu método de pago.</p>`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#0E2A47;padding:24px 32px;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">DomiCita</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="color:#A61E2E;font-size:20px;margin:0 0 16px;">Problema con tu pago</h2>
            <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 12px;">
              Hubo un problema procesando el pago de la suscripción de <strong>${shopName}</strong> en DomiCita.
            </p>
            <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px;">
              Por favor actualiza tu método de pago para continuar usando el servicio sin interrupciones.
            </p>
            ${actionBlock}
            <p style="color:#999;font-size:12px;margin:24px 0 0;">
              Si ya resolviste el problema puedes ignorar este correo. Si tienes dudas contáctanos en soporte@domicita.com.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f4f4f4;padding:16px 32px;text-align:center;">
            <p style="color:#aaa;font-size:12px;margin:0;">© ${new Date().getFullYear()} DomiCita · Todos los derechos reservados</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Problema con el pago de tu suscripción en DomiCita`,
      html,
    });
    console.log(`[email] Payment failed email sent to ${to}`);
  } catch (err) {
    console.error('[email] Failed to send payment failed email:', err);
  }
}
