/**
 * Shared types for WhatsApp connection health-check.
 */

export type BlockerCode =
  | 'PHONE_PENDING'              // status PENDING (Coexistence syncing or Cloud API not registered)
  | 'PHONE_NOT_REGISTERED'       // Cloud API number missing /register call
  | 'NO_PAYMENT'                 // primary_funding_id missing
  | 'NOT_VERIFIED'               // business_verification_status !== verified
  | 'WABA_BLOCKED'               // can_send_message === BLOCKED for unknown reason
  | 'TOKEN_INVALID'              // System User token invalid (sistema-wide)
  | 'PHONE_BLOCKED'              // phone-level health BLOCKED
  | 'NO_PHONE_NUMBER';           // shop has no metaPhoneNumberId

export type IssueCode =
  | 'SUBSCRIPTION_LOST'           // our app not in subscribed_apps
  | 'SUBSCRIPTION_FIELDS_INCOMPLETE'; // missing required subscribed_fields

export interface BlockerAction {
  label: string;
  url?: string;
}

export interface Blocker {
  code: BlockerCode;
  severity: 'critical' | 'warning';
  message: string;       // user-facing en español
  action?: BlockerAction;
}

export interface Issue {
  code: IssueCode;
  message: string;
  autoRepairResult?: 'repaired' | 'failed';
}

export interface HealthCheckResult {
  canReceive: boolean;
  canSend: boolean;
  ready: boolean;
  critical: Blocker[];
  warnings: Blocker[];
  recoverable: Issue[];
}
