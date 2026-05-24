/**
 * WhatsApp Template Constants
 *
 * Shared between client and server code.
 * Keep this file free of server-only imports (db, Prisma, etc.)
 */

// ─── Purpose labels for UI display ──────────────────────────────────

export const PURPOSE_LABELS: Record<string, string> = {
  appointment_reminder_24h: 'Recordatorio 24h',
  appointment_reminder_6h: 'Recordatorio 6h',
  appointment_reminder_2h: 'Recordatorio 2h',
  appointment_reminder_1h: 'Recordatorio 1h',
  appointment_confirmed: 'Confirmacion de cita',
  walkin_notification: 'Turno walk-in',
  new_booking: 'Nueva reserva (admin)',
  cancellation: 'Cancelacion',
  reactivation: 'Reactivacion de cliente',
};
