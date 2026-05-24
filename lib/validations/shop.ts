/**
 * Validation Schemas for Shop
 *
 * These schemas ensure that all shop-related data is properly
 * validated before being processed by the API.
 */

import { z } from 'zod';
import { ShopTypeEnum, ServiceTypeEnum } from './services';

/**
 * Create/Update Shop Schema
 * Validates data when creating or updating a shop
 */
export const updateShopSchema = z.object({
  // Shop name (optional)
  name: z.string()
    .min(2, 'Shop name must be at least 2 characters')
    .max(100, 'Shop name must be less than 100 characters')
    .transform(val => val.trim())
    .optional(),

  // Address (optional)
  address: z.string()
    .max(255, 'Address must be less than 255 characters')
    .optional(),

  // Phone number (optional)
  phoneNumber: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format')
    .optional(),

  // WhatsApp number (optional)
  whatsappNumber: z.string()
    .min(10, 'WhatsApp number must be at least 10 digits')
    .max(15, 'WhatsApp number must be less than 15 digits')
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid WhatsApp number format')
    .optional(),

  // Email (optional)
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .optional()
    .or(z.literal('')),

  // Description (optional)
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),

  // Shop type (optional)
  shopType: ShopTypeEnum.optional(),

  // Website (optional)
  website: z.string()
    .url('Invalid website URL')
    .optional()
    .or(z.literal('')),

  // Social media links (optional)
  instagram: z.string()
    .url('Invalid Instagram URL')
    .optional()
    .or(z.literal('')),
  facebook: z.string()
    .url('Invalid Facebook URL')
    .optional()
    .or(z.literal('')),
});

export type UpdateShopInput = z.infer<typeof updateShopSchema>;

/**
 * Update Business Hours Schema
 * Validates data when updating business hours
 */
export const businessHoursSchema = z.object({
  // Day of week (0 = Sunday, 6 = Saturday)
  dayOfWeek: z.number()
    .int('Day of week must be an integer')
    .min(0, 'Day of week must be between 0 and 6')
    .max(6, 'Day of week must be between 0 and 6'),

  // Open time (format: "HH:MM")
  openTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM'),

  // Close time (format: "HH:MM")
  closeTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM'),

  // Is closed this day (optional)
  isClosed: z.boolean().optional(),
}).refine(
  (data) => {
    // If not closed, close time must be after open time
    if (!data.isClosed) {
      const open = data.openTime.split(':');
      const close = data.closeTime.split(':');
      const openMinutes = parseInt(open[0]) * 60 + parseInt(open[1]);
      const closeMinutes = parseInt(close[0]) * 60 + parseInt(close[1]);
      return closeMinutes > openMinutes;
    }
    return true;
  },
  {
    message: 'Close time must be after open time',
    path: ['closeTime'],
  }
);

export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;

/**
 * Update all business hours schema
 */
export const updateAllBusinessHoursSchema = z.object({
  // Array of business hours for each day
  hours: z.array(businessHoursSchema)
    .length(7, 'Must provide hours for all 7 days of the week'),
});

export type UpdateAllBusinessHoursInput = z.infer<typeof updateAllBusinessHoursSchema>;

/**
 * Shop settings schema
 */
export const shopSettingsSchema = z.object({
  // Time zone (optional)
  timezone: z.string()
    .optional(),

  // Currency (optional, default DOP)
  currency: z.enum(['DOP', 'USD', 'EUR']).optional(),

  // Language (optional, default es)
  language: z.enum(['es', 'en']).optional(),

  // Auto-confirmation of appointments (optional)
  autoConfirmAppointments: z.boolean().optional(),

  // Allow online booking (optional)
  allowOnlineBooking: z.boolean().optional(),

  // Minimum booking notice in hours (optional)
  minBookingNotice: z.number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative')
    .max(168, 'Cannot be more than 7 days (168 hours)')
    .optional(),

  // Maximum booking advance in days (optional)
  maxBookingAdvance: z.number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 day')
    .max(365, 'Cannot be more than 1 year')
    .optional(),
});

export type ShopSettingsInput = z.infer<typeof shopSettingsSchema>;

/**
 * Helper function to validate update shop data
 */
export function validateUpdateShop(data: unknown) {
  return updateShopSchema.safeParse(data);
}

/**
 * Helper function to validate business hours
 */
export function validateBusinessHours(data: unknown) {
  return businessHoursSchema.safeParse(data);
}

/**
 * Helper function to validate all business hours
 */
export function validateAllBusinessHours(data: unknown) {
  return updateAllBusinessHoursSchema.safeParse(data);
}

/**
 * Helper function to validate shop settings
 */
export function validateShopSettings(data: unknown) {
  return shopSettingsSchema.safeParse(data);
}
