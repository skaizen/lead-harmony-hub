import { serverEnv } from "./supabase/admin.server";
import type { ErpnextLead, ErpnextLeadPayload } from "./types";

// Typed ERPNext REST client. Uses token auth: `Authorization: token api_key:api_secret`.
// References: frappe/erpnext lead.py + customer.py for field naming.

export class ErpnextApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `ERPNext API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

interface ErpnextConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

function getConfig(): ErpnextConfig {
  const baseUrl = serverEnv("ERPNEXT_BASE_URL");
  const apiKey = serverEnv("ERPNEXT_API_KEY");
  const apiSecret = serverEnv("ERPNEXT_API_SECRET");
  if (!baseUrl || !apiKey || !apiSecret) {
    throw new Error(
      "Missing ERPNext env vars: ERPNEXT_BASE_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET",
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, apiSecret };
}

function authHeader(cfg: ErpnextConfig): string {
  return `token ${cfg.apiKey}:${cfg.apiSecret}`;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: authHeader(cfg),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw new ErpnextApiError(res.status, body);
  }
  return body as T;
}

export interface ListLeadsParams {
  updated_after?: Date;
  limit?: number;
  offset?: number;
  fields?: string[];
}

const DEFAULT_FIELDS = [
  "name",
  "lead_name",
  "first_name",
  "last_name",
  "email_id",
  "mobile_no",
  "company_name",
  "status",
  "source",
  "notes",
  "modified",
  "creation",
];

export async function listLeads(params: ListLeadsParams = {}): Promise<ErpnextLead[]> {
  const fields = params.fields ?? DEFAULT_FIELDS;
  const filters: unknown[] = [];
  if (params.updated_after) {
    filters.push(["modified", ">", params.updated_after.toISOString()]);
  }
  const qs = new URLSearchParams({
    fields: JSON.stringify(fields),
    limit_page_length: String(params.limit ?? 50),
    limit_start: String(params.offset ?? 0),
    order_by: "modified desc",
  });
  if (filters.length) qs.set("filters", JSON.stringify(filters));
  const res = await request<{ data: ErpnextLead[] }>(`/api/resource/Lead?${qs.toString()}`);
  return res.data ?? [];
}

export async function getLead(name: string): Promise<ErpnextLead> {
  const res = await request<{ data: ErpnextLead }>(
    `/api/resource/Lead/${encodeURIComponent(name)}`,
  );
  return res.data;
}

export async function createLead(payload: ErpnextLeadPayload): Promise<ErpnextLead> {
  const res = await request<{ data: ErpnextLead }>(`/api/resource/Lead`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateLead(
  name: string,
  payload: Partial<ErpnextLeadPayload>,
): Promise<ErpnextLead> {
  const res = await request<{ data: ErpnextLead }>(
    `/api/resource/Lead/${encodeURIComponent(name)}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
  return res.data;
}

export function hasErpnextConfig(): boolean {
  return Boolean(
    serverEnv("ERPNEXT_BASE_URL") &&
      serverEnv("ERPNEXT_API_KEY") &&
      serverEnv("ERPNEXT_API_SECRET"),
  );
}