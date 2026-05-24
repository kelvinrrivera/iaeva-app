/**
 * Validation Schemas for Services
 *
 * These schemas ensure that all service-related data is properly
 * validated before being processed by the API.
 */

import { z } from 'zod';

/**
 * Shop Type enum (for multi-nicho support)
 */
export const ShopTypeEnum = z.enum([
  'BARBERSHOP',
  'BEAUTY_SALON',
  'HYBRID',
] as const);

export type ShopType = z.infer<typeof ShopTypeEnum>;

/**
 * Service Type enum (for multi-nicho support)
 */
export const ServiceTypeEnum = z.enum([
  'HAIRCUT',
  'BEARD',
  'COLOR',
  'STYLING',
  'FACIAL',
  'TREATMENT',
] as const);

export type ServiceType = z.infer<typeof ServiceTypeEnum>;

/**
 * Create Service Schema
 * Validates data when creating a new service
 */
export const createServiceSchema = z.object({
  // Service name (required)
  name: z.string()
    .min(2, 'Service name must be at least 2 characters')
    .max(100, 'Service name must be less than 100 characters')
    .transform(val => val.trim()),

  // Description (optional)
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),

  // Price (required, must be positive)
  price: z.number()
    .positive('Price must be greater than 0')
    .max(100000, 'Price must be less than 100,000'),

  // Duration in minutes (required, must be positive)
  duration: z.number()
    .int('Duration must be a whole number')
    .positive('Duration must be greater than 0')
    .max(480, 'Duration must be less than 8 hours (480 minutes)'),

  // Buffer time in minutes (optional, default 0)
  bufferTime: z.number()
    .int('Buffer time must be a whole number')
    .min(0, 'Buffer time cannot be negative')
    .max(60, 'Buffer time must be less than 60 minutes')
    .default(0)
    .optional(),

  // Service type (required for multi-nicho)
  serviceType: ServiceTypeEnum,

  // Whether service is active (optional, default true)
  isActive: z.boolean().default(true).optional(),

  // Whether service is available for online booking (optional, default true)
  isBookable: z.boolean().default(true).optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/**
 * Update Service Schema
 * Validates data when updating an existing service
 */
export const updateServiceSchema = z.object({
  // Service name (optional)
  name: z.string()
    .min(2, 'Service name must be at least 2 characters')
    .max(100, 'Service name must be less than 100 characters')
    .transform(val => val.trim())
    .optional(),

  // Description (optional)
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),

  // Price (optional, must be positive)
  price: z.number()
    .positive('Price must be greater than 0')
    .max(100000, 'Price must be less than 100,000')
    .optional(),

  // Duration in minutes (optional, must be positive)
  duration: z.number()
    .int('Duration must be a whole number')
    .positive('Duration must be greater than 0')
    .max(480, 'Duration must be less than 8 hours (480 minutes)')
    .optional(),

  // Buffer time in minutes (optional)
  bufferTime: z.number()
    .int('Buffer time must be a whole number')
    .min(0, 'Buffer time cannot be negative')
    .max(60, 'Buffer time must be less than 60 minutes')
    .optional(),

  // Service type (optional)
  serviceType: ServiceTypeEnum.optional(),

  // Whether service is active (optional)
  isActive: z.boolean().optional(),

  // Whether service is available for online booking (optional)
  isBookable: z.boolean().optional(),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/**
 * Query params for filtering services
 */
export const serviceQuerySchema = z.object({
  // Filter by service type
  serviceType: ServiceTypeEnum.optional(),

  // Filter by active status
  isActive: z.coerce.boolean().optional(),

  // Filter by bookable status
  isBookable: z.coerce.boolean().optional(),

  // Search by name
  search: z.string().min(2).max(100).optional(),

  // Pagination
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),

  // Sort by field
  sortBy: z.enum(['name', 'price', 'duration', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type ServiceQueryInput = z.infer<typeof serviceQuerySchema>;

/**
 * Helper function to validate create service data
 */
export function validateCreateService(data: unknown) {
  return createServiceSchema.safeParse(data);
}

/**
 * Helper function to validate update service data
 */
export function validateUpdateService(data: unknown) {
  return updateServiceSchema.safeParse(data);
}

/**
 * Helper function to validate query params
 */
export function validateServiceQuery(data: unknown) {
  return serviceQuerySchema.safeParse(data);
}

/**
 * Format price for display
 * Converts: 1500 -> "RD$1,500"
 */
export function formatPrice(price: number): string {
  return `RD$${price.toLocaleString('es-DO')}`;
}

/**
 * Format duration for display
 * Converts: 90 -> "1h 30min"
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}min`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}min`;
}

/**
 * Calculate end time given start time and duration
 */
export function calculateEndTime(startTime: Date, durationMinutes: number): Date {
  return new Date(startTime.getTime() + durationMinutes * 60000);
}
