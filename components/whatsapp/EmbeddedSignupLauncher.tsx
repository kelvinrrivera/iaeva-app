'use client';

import { useCallback, useState } from 'react';
import FacebookSDKScript from '@/components/whatsapp/FacebookSDKScript';

// Note: Window.FB is declared in FacebookSDKScript.tsx as `FB: any`.
// We rely on that global declaration instead of redeclaring (conflicts cause
// Vercel build to fail with "All declarations of 'FB' must have identical modifiers").

export type FeatureType = 'coexistence' | 'cloud_api';

export interface EmbeddedSignupResult {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  featureType: FeatureType;
}

export interface EmbeddedSignupLauncherProps {
  featureType: FeatureType;
  onSuccess: (result: EmbeddedSignupResult) => void;
  onError: (message: string) => void;
  onCancel?: () => void;
  buttonClassName?: string;
  buttonLabel?: string;
  disabled?: boolean;
}

const FB_TRUSTED_ORIGINS = ['https://www.facebook.com', 'https://web.facebook.com'];

const FINISH_EVENTS = new Set([
  'FINISH',                                  // legacy
  'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', // Coexistence v3
]);

/**
 * Embedded Signup launcher. Opens Meta's popup with the correct
 * sessionInfoVersion and featureType, captures phone_number_id + waba_id
 * via postMessage, then resolves the auth code via FB.login callback.
 */
export function EmbeddedSignupLauncher({
  featureType,
  onSuccess,
  onError,
  onCancel,
  buttonClassName = 'inline-flex items-center justify-center px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50',
  buttonLabel,
  disabled = false,
}: EmbeddedSignupLauncherProps) {
  const [busy, setBusy] = useState(false);

  const launch = useCallback(() => {
    if (typeof window === 'undefined' || !window.FB) {
      onError('SDK de Facebook no cargado. Recarga la página y vuelve a intentar.');
      return;
    }
    setBusy(true);

    let metaHints: { wabaId?: string; phoneNumberId?: string } = {};
    const messageHandler = (event: MessageEvent) => {
      if (!FB_TRUSTED_ORIGINS.includes(event.origin)) return;
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg?.type === 'WA_EMBEDDED_SIGNUP' && FINISH_EVENTS.has(msg?.event)) {
          metaHints = {
            wabaId: msg.data?.waba_id,
            phoneNumberId: msg.data?.phone_number_id,
          };
        }
      } catch {
        /* ignore non-JSON payloads */
      }
    };
    window.addEventListener('message', messageHandler);

    const extras: any = {
      sessionInfoVersion: 3,
    };
    if (featureType === 'coexistence') {
      extras.featureType = 'whatsapp_business_app_onboarding';
    }
    const solutionId = process.env.NEXT_PUBLIC_FB_SOLUTION_ID;
    if (solutionId) {
      extras.setup = { solutionID: solutionId };
    }

    window.FB.login(
      (response: any) => {
        window.removeEventListener('message', messageHandler);
        setBusy(false);

        if (!response.authResponse) {
          if (onCancel) onCancel();
          else onError('Conexión cancelada');
          return;
        }
        if (!metaHints.wabaId || !metaHints.phoneNumberId) {
          onError('Meta no devolvió los datos del número. Inténtalo de nuevo y completa todos los pasos del registro.');
          return;
        }
        const code = response.authResponse.code;
        if (!code) {
          onError('Meta no devolvió el código de autorización. Vuelve a intentar.');
          return;
        }
        onSuccess({
          code,
          wabaId: metaHints.wabaId,
          phoneNumberId: metaHints.phoneNumberId,
          featureType,
        });
      },
      {
        config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras,
      },
    );
  }, [featureType, onSuccess, onError, onCancel]);

  const defaultLabel = featureType === 'coexistence'
    ? 'Conectar con WhatsApp Business app'
    : 'Conectar solo con DomiCita';

  return (
    <>
      <FacebookSDKScript />
      <button
        type="button"
        onClick={launch}
        disabled={disabled || busy}
        className={buttonClassName}
      >
        {busy ? 'Conectando…' : (buttonLabel || defaultLabel)}
      </button>
    </>
  );
}
