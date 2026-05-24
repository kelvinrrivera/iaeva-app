/**
 * Validation Schemas for Team Members
 *
 * These schemas ensure that all team-related data is properly
 * validated before being processed by the API.
 */

import { z } from 'zod';

/**
 * Role enum
 */
export const RoleEnum = z.enum([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'TEAM_LEADER',
  'PROFESSIONAL',
  'CUSTOMER',
] as const);

export type Role = z.infer<typeof RoleEnum>;

/**
 * Create Team Member Schema
 * Validates data when creating a new team member
 */
export const createTeamMemberSchema = z.object({
  // Member name (required)
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .transform(val => val.trim()),

  // Email (optional)
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .optional()
    .or(z.literal('')),

  // Phone number (optional)
  phoneNumber: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format')
    .optional(),

  // Role (required)
  role: RoleEnum.refine(
    (val) => ['TEAM_LEADER', 'PROFESSIONAL'].includes(val),
    'Role must be TEAM_LEADER or PROFESSIONAL'
  ),

  // Specialties (optional)
  specialties: z.array(z.string())
    .max(10, 'Cannot have more than 10 specialties')
    .optional(),

  // Commission percentage (optional)
  commissionPercentage: z.number()
    .min(0, 'Commission cannot be negative')
    .max(100, 'Commission cannot exceed 100%')
    .optional(),

  // Notes (optional)
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),

  // Is active (optional, default true)
  isActive: z.boolean().default(true).optional(),
});

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>;

/**
 * Update Team Member Schema
 * Validates data when updating an existing team member
 */
export const updateTeamMemberSchema = z.object({
  // Member name (optional)
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .transform(val => val.trim())
    .optional(),

  // Email (optional)
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .optional()
    .or(z.literal(''))
    .or(z.undefined()),

  // Phone number (optional)
  phoneNumber: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number must be less than 15 digits')
    .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format')
    .optional(),

  // Role (optional)
  role: RoleEnum.refine(
    (val) => ['TEAM_LEADER', 'PROFESSIONAL'].includes(val),
    'Role must be TEAM_LEADER or PROFESSIONAL'
  ).optional(),

  // Specialties (optional)
  specialties: z.array(z.string())
    .max(10, 'Cannot have more than 10 specialties')
    .optional(),

  // Commission percentage (optional)
  commissionPercentage: z.number()
    .min(0, 'Commission cannot be negative')
    .max(100, 'Commission cannot exceed 100%')
    .optional(),

  // Notes (optional)
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),

  // Is active (optional)
  isActive: z.boolean().optional(),
});

export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;

/**
 * Invite Team Member Schema
 * Validates data when inviting a new team member
 */
export const inviteTeamMemberSchema = z.object({
  // Email (required)
  email: z.string()
    .email('Invalid email format')
    .toLowerCase(),

  // Role (required)
  role: RoleEnum.refine(
    (val) => ['ORG_ADMIN', 'TEAM_LEADER', 'PROFESSIONAL'].includes(val),
    'Invalid role for invitation'
  ),

  // Personalized message (optional)
  message: z.string()
    .max(500, 'Message must be less than 500 characters')
    .optional(),
});

export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

/**
 * Accept Invitation Schema
 * Validates data when accepting an invitation
 */
export const acceptInvitationSchema = z.object({
  // Invitation token (required)
  token: z.string()
    .min(10, 'Invalid invitation token')
    .max(500, 'Invalid invitation token'),

  // Name (required)
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .transform(val => val.trim()),

  // Password (required, min 8 characters)
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

/**
 * Query params for filtering team members
 */
export const teamMemberQuerySchema = z.object({
  // Filter by role
  role: RoleEnum.optional(),

  // Filter by active status
  isActive: z.coerce.boolean().optional(),

  // Search by name or email
  search: z.string().min(2).max(100).optional(),

  // Pagination
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),

  // Sort by field
  sortBy: z.enum(['name', 'createdAt', 'role']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type TeamMemberQueryInput = z.infer<typeof teamMemberQuerySchema>;

/**
 * Helper function to validate create team member data
 */
export function validateCreateTeamMember(data: unknown) {
  return createTeamMemberSchema.safeParse(data);
}

/**
 * Helper function to validate update team member data
 */
export function validateUpdateTeamMember(data: unknown) {
  return updateTeamMemberSchema.safeParse(data);
}

/**
 * Helper function to validate invite data
 */
export function validateInviteTeamMember(data: unknown) {
  return inviteTeamMemberSchema.safeParse(data);
}

/**
 * Helper function to validate accept invitation data
 */
export function validateAcceptInvitation(data: unknown) {
  return acceptInvitationSchema.safeParse(data);
}

/**
 * Helper function to validate query params
 */
export function validateTeamMemberQuery(data: unknown) {
  return teamMemberQuerySchema.safeParse(data);
}
