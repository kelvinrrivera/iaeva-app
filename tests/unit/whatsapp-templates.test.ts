import { describe, it, expect } from 'vitest';
import {
  getTemplateName,
  buildTemplateMessage,
  getAppointmentConfirmationParams,
  getAppointmentReminderParams,
  getNewBookingParams,
  TEMPLATE_NAMES,
} from '@/lib/whatsapp/templates';

describe('whatsapp templates', () => {
  describe('getTemplateName', () => {
    it('combines shopType and baseName correctly for BARBERSHOP', () => {
      expect(getTemplateName('appointment_confirmed', 'BARBERSHOP')).toBe(
        'barbershop_appointment_confirmed'
      );
    });

    it('combines shopType and baseName correctly for BEAUTY_SALON', () => {
      expect(getTemplateName('appointment_reminder', 'BEAUTY_SALON')).toBe(
        'beauty_salon_appointment_reminder'
      );
    });

    it('combines shopType and baseName correctly for HYBRID', () => {
      expect(getTemplateName('new_booking', 'HYBRID')).toBe(
        'hybrid_new_booking'
      );
    });
  });

  describe('TEMPLATE_NAMES', () => {
    it('has all required template types', () => {
      expect(TEMPLATE_NAMES.APPOINTMENT_CONFIRMED).toBe('appointment_confirmed');
      expect(TEMPLATE_NAMES.APPOINTMENT_REMINDER).toBe('appointment_reminder');
      expect(TEMPLATE_NAMES.NEW_BOOKING).toBe('new_booking');
      expect(TEMPLATE_NAMES.CANCELLATION_NOTICE).toBe('cancellation_notice');
      expect(TEMPLATE_NAMES.RESCHEDULE_NOTICE).toBe('reschedule_notice');
      expect(TEMPLATE_NAMES.WELCOME_MESSAGE).toBe('welcome_message');
    });
  });

  describe('buildTemplateMessage', () => {
    const baseParams = {
      clientName: 'Juan',
      serviceName: 'Corte Clásico',
      date: '2025-03-15',
      time: '10:00',
      professionalName: 'Carlos',
      shopName: 'BarberPro',
      shopAddress: 'Calle 1, Santo Domingo',
    };

    it('builds appointment confirmed message with params', () => {
      const msg = buildTemplateMessage(
        TEMPLATE_NAMES.APPOINTMENT_CONFIRMED,
        'BARBERSHOP',
        baseParams
      );
      expect(msg).toContain('Juan');
      expect(msg).toContain('Corte Clásico');
      expect(msg).toContain('2025-03-15');
      expect(msg).toContain('10:00');
      expect(msg).toContain('Carlos');
      expect(msg).toContain('BarberPro');
      expect(msg).toContain('confirmada');
    });

    it('builds appointment reminder message', () => {
      const msg = buildTemplateMessage(
        TEMPLATE_NAMES.APPOINTMENT_REMINDER,
        'BARBERSHOP',
        baseParams
      );
      expect(msg).toContain('Recordatorio');
      expect(msg).toContain('Juan');
      expect(msg).toContain('Corte Clásico');
    });

    it('builds new booking notification', () => {
      const msg = buildTemplateMessage(
        TEMPLATE_NAMES.NEW_BOOKING,
        'BARBERSHOP',
        { ...baseParams, clientPhone: '+18091234567' }
      );
      expect(msg).toContain('Nueva Cita');
      expect(msg).toContain('Juan');
    });

    it('builds cancellation notice', () => {
      const msg = buildTemplateMessage(
        TEMPLATE_NAMES.CANCELLATION_NOTICE,
        'BARBERSHOP',
        baseParams
      );
      expect(msg).toContain('Cancelada');
      expect(msg).toContain('Juan');
    });

    it('builds welcome message', () => {
      const msg = buildTemplateMessage(
        TEMPLATE_NAMES.WELCOME_MESSAGE,
        'BARBERSHOP',
        baseParams
      );
      expect(msg).toContain('Bienvenido');
      expect(msg).toContain('BarberPro');
    });

    it('returns fallback for unknown template type', () => {
      const msg = buildTemplateMessage(
        'nonexistent_template' as any,
        'BARBERSHOP',
        baseParams
      );
      expect(msg).toBe('Mensaje no disponible');
    });

    it('uses correct terminology for BEAUTY_SALON', () => {
      const msg = buildTemplateMessage(
        TEMPLATE_NAMES.APPOINTMENT_CONFIRMED,
        'BEAUTY_SALON',
        baseParams
      );
      // Beauty salon uses "el estilista" instead of "el barbero"
      expect(msg).toContain('el estilista');
    });
  });

  describe('getAppointmentConfirmationParams', () => {
    it('returns params in correct order', () => {
      const params = getAppointmentConfirmationParams({
        clientName: 'Juan',
        serviceName: 'Corte',
        date: '2025-03-15',
        time: '10:00',
        professionalName: 'Carlos',
        shopName: 'BarberPro',
        shopAddress: 'Calle 1',
      });
      expect(params).toEqual([
        'Juan', 'Corte', '2025-03-15', '10:00', 'Carlos', 'BarberPro', 'Calle 1',
      ]);
    });
  });

  describe('getAppointmentReminderParams', () => {
    it('returns params in correct order', () => {
      const params = getAppointmentReminderParams({
        clientName: 'Juan',
        serviceName: 'Corte',
        date: '2025-03-15',
        time: '10:00',
        shopName: 'BarberPro',
      });
      expect(params).toEqual(['Juan', '2025-03-15', '10:00', 'Corte', 'BarberPro']);
    });
  });

  describe('getNewBookingParams', () => {
    it('returns params in correct order', () => {
      const params = getNewBookingParams({
        clientName: 'Juan',
        clientPhone: '+18091234567',
        serviceName: 'Corte',
        date: '2025-03-15',
        time: '10:00',
      });
      expect(params).toEqual(['Juan', '+18091234567', 'Corte', '2025-03-15', '10:00']);
    });
  });
});
