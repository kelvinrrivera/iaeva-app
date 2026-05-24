/**
 * Validation Schemas for Clients
 *
 * These schemas ensure that all client-related data is properly
 * validated before being processed by the API.
 */

import { z } from 'zod';

/**
 * Dominican Republic phone number regex
 * Supports formats: +18091234567, 809-123-4567, (809) 123-4567, etc.
 */
const DR_PHONE_REGEX = /^(\+1)?[\s\−]?[(]?[8,9][0-9]{2}[)]?[\s\−]?[0-9]{3}[\s\−]?[0-9]{4}$/;

/**
 * Create Client Schema
 * Validates data when creating a new client
 */
export const createClientSchema = z.object({
  // Client name (required)
  name: z.string()
    .min(2, 'Client name must be at least 2 characters')
    .max(100, 'Client name must be less than 100 characters')
    .transform(val => val.trim()),

  // Phone number (required, DR format)
  phoneNumber: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(DR_PHONE_REGEX, 'Invalid Dominican Republic phone number format. Use format: 809-123-4567 or +18091234567')
    .transform(val => val.replace(/[\s\−()]/g, '')), // Remove spaces, dashes, and parentheses

  // Email (optional)
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .optional()
    .or(z.literal('')),

  // Notes (optional)
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),

  // Preferred contact method (optional)
  preferredContact: z.enum(['WHATSAPP', 'EMAIL', 'PHONE', 'SMS']).optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

/**
 * Update Client Schema
 * Validates data when updating an existing client
 */
export const updateClientSchema = z.object({
  // Client name (optional)
  name: z.string()
    .min(2, 'Client name must be at least 2 characters')
    .max(100, 'Client name must be less than 100 characters')
    .transform(val => val.trim())
    .optional(),

  // Phone number (optional, DR format)
  phoneNumber: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(DR_PHONE_REGEX, 'Invalid Dominican Republic phone number format')
    .transform(val => val.replace(/[\s\−()]/g, ''))
    .optional(),

  // Email (optional)
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .optional()
    .or(z.literal(''))
    .or(z.undefined()),

  // Notes (optional)
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),

  // Preferred contact method (optional)
  preferredContact: z.enum(['WHATSAPP', 'EMAIL', 'PHONE', 'SMS']).optional(),

  // Active status (optional)
  isActive: z.boolean().optional(),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

/**
 * Query params for filtering clients
 */
export const clientQuerySchema = z.object({
  // Search by name or phone
  search: z.string().min(2).max(100).optional(),

  // Filter by active status
  isActive: z.coerce.boolean().optional(),

  // Pagination
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),

  // Sort by field
  sortBy: z.enum(['name', 'createdAt', 'lastVisit']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type ClientQueryInput = z.infer<typeof clientQuerySchema>;

/**
 * Helper function to validate create client data
 */
export function validateCreateClient(data: unknown) {
  return createClientSchema.safeParse(data);
}

/**
 * Helper function to validate update client data
 */
export function validateUpdateClient(data: unknown) {
  return updateClientSchema.safeParse(data);
}

/**
 * Helper function to validate query params
 */
export function validateClientQuery(data: unknown) {
  return clientQuerySchema.safeParse(data);
}

/**
 * Validate and format phone number to standard format
 * Converts: 8091234567 -> +18091234567
 */
export function formatDRPhoneNumber(phone: string): string {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');

  // Add +1 if missing
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // Already has country code
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  return phone;
}

/**
 * Extract area code from DR phone number
 * Returns: 809, 829, or 849
 */
export function getDRAreaCode(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length >= 10) {
    const areaCode = cleaned.substring(0, 3);
    if (['809', '829', '849'].includes(areaCode)) {
      return areaCode;
    }
  }

  return null;
}
