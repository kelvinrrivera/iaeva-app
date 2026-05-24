/**
 * WhatsApp Message Templates
 *
 * Pre-defined templates for WhatsApp Business API.
 * Templates must be approved by Meta before use.
 *
 * Multi-nicho support: Templates adapt terminology based on shop type.
 *
 * Template Naming Convention: {shop_type}_{template_name}_{language}
 * Example: BARBERSHOP_APPOINTMENT_CONFIRMED_es
 */

import type { ShopType } from '@prisma/client';
import { getTerminology } from '@/lib/terminology';

export interface WhatsAppTemplate {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  allowCategoryChange: boolean;
}

/**
 * Template names by shop type
 */
export const TEMPLATE_NAMES = {
  APPOINTMENT_CONFIRMED: 'appointment_confirmed',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  NEW_BOOKING: 'new_booking',
  CANCELLATION_NOTICE: 'cancellation_notice',
  RESCHEDULE_NOTICE: 'reschedule_notice',
  WELCOME_MESSAGE: 'welcome_message',
} as const;

/**
 * Get template name with shop type prefix
 *
 * @param baseName - Base template name
 * @param shopType - Type of shop
 * @returns Full template name
 *
 * @example
 * getTemplateName('appointment_confirmed', 'BARBERSHOP')
 * // Returns: 'barbershop_appointment_confirmed'
 */
export function getTemplateName(baseName: string, shopType: ShopType): string {
  return `${shopType.toLowerCase()}_${baseName}`;
}

/**
 * Build template message with dynamic content
 *
 * @param templateType - Type of template
 * @param shopType - Type of shop
 * @param params - Parameters to fill template
 * @returns Formatted message (for fallback when template not approved)
 */
export function buildTemplateMessage(
  templateType: (typeof TEMPLATE_NAMES)[keyof typeof TEMPLATE_NAMES],
  shopType: ShopType,
  params: Record<string, string>
): string {
  const terminology = getTerminology(shopType);

  const templates = {
    [TEMPLATE_NAMES.APPOINTMENT_CONFIRMED]: `✅ Tu cita está confirmada

Hola ${params.clientName}! Tu cita para ${params.serviceName} está confirmada.

📅 Fecha: ${params.date}
⏰ Hora: ${params.time}
👤 ${terminology.professional.professionalWithArticle}: ${params.professionalName}

📍 ${params.shopName}
📍 ${params.shopAddress}

Te esperamos!`,

    [TEMPLATE_NAMES.APPOINTMENT_REMINDER]: `⏰ Recordatorio de cita

Hola ${params.clientName}! Te recordamos que tienes una cita mañana.

📅 Fecha: ${params.date}
⏰ Hora: ${params.time}
💇 Servicio: ${params.serviceName}

📍 ${params.shopName}

Por favor llega 10 minutos antes.`,

    [TEMPLATE_NAMES.NEW_BOOKING]: `🎉 Nueva Cita Agendada

Tienes una nueva solicitud de cita:

👤 Cliente: ${params.clientName}
📱 Teléfono: ${params.clientPhone}
💇 Servicio: ${params.serviceName}
📅 Fecha: ${params.date}
⏰ Hora: ${params.time}`,

    [TEMPLATE_NAMES.CANCELLATION_NOTICE]: `❌ Cita Cancelada

Hola ${params.clientName}! Tu cita para ${params.serviceName} ha sido cancelada.

📅 Fecha original: ${params.date}
⏰ Hora: ${params.time}

Si deseas reagendar, contáctanos.`,

    [TEMPLATE_NAMES.RESCHEDULE_NOTICE]: `🔄 Cita Reagendada

Hola ${params.clientName}! Tu cita ha sido reagendada.

📅 Nueva fecha: ${params.newDate}
⏰ Nueva hora: ${params.newTime}
💇 Servicio: ${params.serviceName}

📍 ${params.shopName}`,

    [TEMPLATE_NAMES.WELCOME_MESSAGE]: `¡Bienvenido a ${params.shopName}! 👋

Gracias por contactarnos. Soy el asistente virtual de ${params.shopName}.

📱 Puedo ayudarte a:
• Agendar una cita
• Consultar disponibilidad
• Ver nuestros servicios
• Cancelar o reagendar

¿En qué puedo ayudarte hoy?`,
  };

  return templates[templateType] || 'Mensaje no disponible';
}

/**
 * Get template parameters for appointment confirmation
 *
 * @param appointmentData - Appointment details
 * @returns Parameters array for template
 */
export function getAppointmentConfirmationParams(appointmentData: {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  professionalName: string;
  shopName: string;
  shopAddress: string;
}): string[] {
  return [
    appointmentData.clientName,
    appointmentData.serviceName,
    appointmentData.date,
    appointmentData.time,
    appointmentData.professionalName,
    appointmentData.shopName,
    appointmentData.shopAddress,
  ];
}

/**
 * Get template parameters for appointment reminder
 *
 * @param appointmentData - Appointment details
 * @returns Parameters array for template
 */
export function getAppointmentReminderParams(appointmentData: {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  shopName: string;
}): string[] {
  return [
    appointmentData.clientName,
    appointmentData.date,
    appointmentData.time,
    appointmentData.serviceName,
    appointmentData.shopName,
  ];
}

/**
 * Get template parameters for new booking notification
 *
 * @param bookingData - Booking details
 * @returns Parameters array for template
 */
export function getNewBookingParams(bookingData: {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  date: string;
  time: string;
}): string[] {
  return [
    bookingData.clientName,
    bookingData.clientPhone,
    bookingData.serviceName,
    bookingData.date,
    bookingData.time,
  ];
}

/**
 * Template definitions for Meta approval
 *
 * These templates need to be submitted to Meta for approval.
 * Reference: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */
export const TEMPLATES_FOR_APPROVAL: Record<ShopType, WhatsAppTemplate[]> = {
  BARBERSHOP: [
    {
      name: 'barbershop_appointment_confirmed',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
    {
      name: 'barbershop_appointment_reminder',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
    {
      name: 'barbershop_new_booking',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
    {
      name: 'barbershop_cancellation_notice',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
  ],
  BEAUTY_SALON: [
    {
      name: 'beauty_salon_appointment_confirmed',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
    {
      name: 'beauty_salon_appointment_reminder',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
    {
      name: 'beauty_salon_new_booking',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
  ],
  HYBRID: [
    {
      name: 'hybrid_appointment_confirmed',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
    {
      name: 'hybrid_appointment_reminder',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
    {
      name: 'hybrid_new_booking',
      category: 'UTILITY',
      allowCategoryChange: false,
    },
  ],
};

/**
 * Helper function to send appointment confirmation
 *
 * @param to - Phone number
 * @param appointmentData - Appointment details
 * @param shopType - Type of shop
 * @param useTemplate - Whether to use approved template (fallback to text if false)
 */
export async function sendAppointmentConfirmation(
  to: string,
  appointmentData: {
    clientName: string;
    serviceName: string;
    date: string;
    time: string;
    professionalName: string;
    shopName: string;
    shopAddress: string;
  },
  shopType: ShopType,
  shopId: string,
  useTemplate: boolean = false
) {
  const { sendWhatsAppMessage, sendWhatsAppTemplate } = await import('./sender');

  if (useTemplate) {
    // Try to send as approved template
    return await sendWhatsAppTemplate({
      to,
      templateName: getTemplateName(TEMPLATE_NAMES.APPOINTMENT_CONFIRMED, shopType),
      parameters: getAppointmentConfirmationParams(appointmentData),
      shopId,
    });
  } else {
    // Send as text message (fallback)
    const message = buildTemplateMessage(
      TEMPLATE_NAMES.APPOINTMENT_CONFIRMED,
      shopType,
      appointmentData
    );
    return await sendWhatsAppMessage({ to, message, shopId });
  }
}

/**
 * Helper function to send appointment reminder
 *
 * @param to - Phone number
 * @param appointmentData - Appointment details
 * @param shopType - Type of shop
 * @param useTemplate - Whether to use approved template
 */
export async function sendAppointmentReminder(
  to: string,
  appointmentData: {
    clientName: string;
    serviceName: string;
    date: string;
    time: string;
    shopName: string;
  },
  shopType: ShopType,
  shopId: string,
  useTemplate: boolean = false
) {
  const { sendWhatsAppMessage, sendWhatsAppTemplate } = await import('./sender');

  if (useTemplate) {
    return await sendWhatsAppTemplate({
      to,
      templateName: getTemplateName(TEMPLATE_NAMES.APPOINTMENT_REMINDER, shopType),
      parameters: getAppointmentReminderParams(appointmentData),
      shopId,
    });
  } else {
    const message = buildTemplateMessage(
      TEMPLATE_NAMES.APPOINTMENT_REMINDER,
      shopType,
      appointmentData
    );
    return await sendWhatsAppMessage({ to, message, shopId });
  }
}

/**
 * Helper function to send new booking notification to business
 *
 * @param to - Business phone number
 * @param bookingData - Booking details
 * @param shopType - Type of shop
 * @param useTemplate - Whether to use approved template
 */
export async function sendNewBookingNotification(
  to: string,
  bookingData: {
    clientName: string;
    clientPhone: string;
    serviceName: string;
    date: string;
    time: string;
  },
  shopType: ShopType,
  shopId: string,
  useTemplate: boolean = false
) {
  const { sendWhatsAppMessage, sendWhatsAppTemplate } = await import('./sender');

  if (useTemplate) {
    return await sendWhatsAppTemplate({
      to,
      templateName: getTemplateName(TEMPLATE_NAMES.NEW_BOOKING, shopType),
      parameters: getNewBookingParams(bookingData),
      shopId,
    });
  } else {
    const message = buildTemplateMessage(
      TEMPLATE_NAMES.NEW_BOOKING,
      shopType,
      bookingData
    );
    return await sendWhatsAppMessage({ to, message, shopId });
  }
}
