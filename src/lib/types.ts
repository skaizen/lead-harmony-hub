// Shared domain types for the Lead Ops dashboard.

export type LeadSource = "erpnext" | "google_ads" | "meta_ads" | "wordpress" | "manual";
export type LeadStatus = "New" | "Contacted" | "Qualified" | "Converted" | "Lost";

export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  source: LeadSource;
  external_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: LeadStatus;
  owner: string | null;
  notes: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  google_ads_campaign_id: string | null;
  google_ads_ad_group_id: string | null;
  google_ads_ad_id: string | null;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_ad_id: string | null;
  wordpress_form_id: string | null;
  erpnext_lead_name: string | null;
  erpnext_last_synced_at: string | null;
}

export type LeadEventType =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "ERP_SYNC"
  | "NOTE_ADDED"
  | "ERROR";

export interface LeadEvent {
  id: string;
  lead_id: string;
  created_at: string;
  event_type: LeadEventType;
  payload: Record<string, unknown>;
  user_id: string | null;
}

export type SyncDirection = "PULL" | "PUSH";
export type SyncOperation = "CREATE" | "UPDATE";
export type SyncStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface ErpSyncLog {
  id: string;
  lead_id: string | null;
  direction: SyncDirection;
  operation: SyncOperation;
  status: SyncStatus;
  triggered_by_user_id: string | null;
  requested_at: string;
  completed_at: string | null;
  erpnext_lead_name: string | null;
  error_message: string | null;
  payload_snapshot: Record<string, unknown> | null;
}

// Aligned to ERPNext Lead DocType core fields.
export interface ErpnextLeadPayload {
  lead_name?: string;
  first_name?: string;
  last_name?: string;
  email_id?: string;
  mobile_no?: string;
  company_name?: string;
  status?: string;
  source?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface ErpnextLead extends ErpnextLeadPayload {
  name: string;
  modified?: string;
  creation?: string;
}