/**
 * Validation Schemas for Appointments
 *
 * These schemas ensure that all appointment-related data is properly
 * validated before being processed by the API.
 */

import { z } from 'zod';

/**
 * Appointment status enum
 */
export const AppointmentStatusEnum = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const);

export type AppointmentStatus = z.infer<typeof AppointmentStatusEnum>;

/**
 * Create Appointment Schema
 * Validates data when creating a new appointment
 */
export const createAppointmentSchema = z.object({
  // Client information
  clientName: z.string()
    .min(2, 'Client name must be at least 2 characters')
    .max(100, 'Client name must be less than 100 characters'),
  clientWhatsApp: z.string()
    .min(10, 'Phone number must be at least 10 characters')
    .max(15, 'Phone number must be less than 15 characters')
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format'),

  // Service ID (required)
  serviceId: z.string()
    .cuid('Invalid service ID format'),

  // Stylist ID (required)
  stylistId: z.string()
    .cuid('Invalid stylist ID format'),

  // Start time (required, ISO 8601 format)
  startTime: z.string()
    .datetime('Invalid start time format. Use ISO 8601 format'),

  // End time (required, ISO 8601 format)
  endTime: z.string()
    .datetime('Invalid end time format. Use ISO 8601 format'),

  // Optional notes
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),

  // Status (defaults to CONFIRMED if not provided)
  status: AppointmentStatusEnum.optional(),
}).refine(
  (data) => {
    // Ensure endTime is after startTime
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    return end > start;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
).refine(
  (data) => {
    // Ensure appointment is in the future
    const start = new Date(data.startTime);
    return start > new Date();
  },
  {
    message: 'Appointment must be scheduled in the future',
    path: ['startTime'],
  }
);

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

/**
 * Update Appointment Schema
 * Validates data when updating an existing appointment
 */
export const updateAppointmentSchema = z.object({
  // Client information (optional)
  clientName: z.string()
    .min(2, 'Client name must be at least 2 characters')
    .max(100, 'Client name must be less than 100 characters')
    .optional(),
  clientWhatsApp: z.string()
    .min(10, 'Phone number must be at least 10 characters')
    .max(15, 'Phone number must be less than 15 characters')
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format')
    .optional(),

  // Service ID (optional)
  serviceId: z.string()
    .cuid('Invalid service ID format')
    .optional(),

  // Stylist ID (optional)
  stylistId: z.string()
    .cuid('Invalid stylist ID format')
    .optional(),

  // Start time (optional, ISO 8601 format)
  startTime: z.string()
    .datetime('Invalid start time format. Use ISO 8601 format')
    .optional(),

  // End time (optional, ISO 8601 format)
  endTime: z.string()
    .datetime('Invalid end time format. Use ISO 8601 format')
    .optional(),

  // Notes (optional)
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),

  // Status (optional)
  status: AppointmentStatusEnum.optional(),
}).refine(
  (data) => {
    // If both start and end time are provided, ensure end is after start
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return end > start;
    }
    return true;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime'],
  }
);

export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

/**
 * Cancel Appointment Schema
 * Validates data when cancelling an appointment
 */
export const cancelAppointmentSchema = z.object({
  // Reason for cancellation (optional)
  reason: z.string()
    .max(500, 'Reason must be less than 500 characters')
    .optional(),

  // Cancelled by (client or shop)
  cancelledBy: z.enum(['CLIENT', 'SHOP']).optional(),
});

export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

/**
 * Query params for filtering appointments
 */
export const appointmentQuerySchema = z.object({
  // Filter by date (ISO 8601 format)
  date: z.string().datetime().optional(),

  // Filter by status
  status: AppointmentStatusEnum.optional(),

  // Filter by stylist
  stylistId: z.string().cuid().optional(),

  // Filter by client
  clientId: z.string().cuid().optional(),

  // Pagination
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type AppointmentQueryInput = z.infer<typeof appointmentQuerySchema>;

/**
 * Helper function to validate request body
 */
export function validateCreateAppointment(data: unknown) {
  return createAppointmentSchema.safeParse(data);
}

/**
 * Helper function to validate update data
 */
export function validateUpdateAppointment(data: unknown) {
  return updateAppointmentSchema.safeParse(data);
}

/**
 * Helper function to validate cancellation data
 */
export function validateCancelAppointment(data: unknown) {
  return cancelAppointmentSchema.safeParse(data);
}

/**
 * Helper function to validate query params
 */
export function validateAppointmentQuery(data: unknown) {
  return appointmentQuerySchema.safeParse(data);
}
