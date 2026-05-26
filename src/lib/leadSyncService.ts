import { getSupabaseAdmin } from "./supabase/server";
import {
  ErpnextApiError,
  createLead as erpCreateLead,
  getLead as erpGetLead,
  listLeads as erpListLeads,
  updateLead as erpUpdateLead,
} from "./erpnextClient";
import type {
  ErpSyncLog,
  ErpnextLead,
  ErpnextLeadPayload,
  Lead,
  SyncOperation,
} from "./types";

// Orchestrates Supabase <-> ERPNext sync and writes audit rows to erp_sync_log + lead_events.

function mapLeadToErpnext(lead: Lead): ErpnextLeadPayload {
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
  return {
    lead_name: fullName || lead.email || lead.phone || "Unnamed Lead",
    first_name: lead.first_name ?? undefined,
    last_name: lead.last_name ?? undefined,
    email_id: lead.email ?? undefined,
    mobile_no: lead.phone ?? undefined,
    company_name: lead.company_name ?? undefined,
    status: lead.status,
    source: lead.utm_source ?? lead.source,
    notes: lead.notes ?? undefined,
  };
}

function mapErpnextToLead(erp: ErpnextLead): Partial<Lead> {
  return {
    source: "erpnext",
    external_id: erp.name,
    erpnext_lead_name: erp.name,
    first_name: (erp.first_name as string | undefined) ?? null,
    last_name: (erp.last_name as string | undefined) ?? null,
    email: (erp.email_id as string | undefined) ?? null,
    phone: (erp.mobile_no as string | undefined) ?? null,
    company_name: (erp.company_name as string | undefined) ?? null,
    status: normalizeStatus(erp.status as string | undefined),
    notes: (erp.notes as string | undefined) ?? null,
    erpnext_last_synced_at: new Date().toISOString(),
  };
}

function normalizeStatus(s: string | undefined): Lead["status"] {
  const allowed: Lead["status"][] = ["New", "Contacted", "Qualified", "Converted", "Lost"];
  if (s && (allowed as string[]).includes(s)) return s as Lead["status"];
  return "New";
}

export interface SyncResult {
  ok: boolean;
  log_id: string;
  erpnext_lead_name?: string;
  error?: string;
}

export async function syncLeadToErpnext(
  leadId: string,
  triggeredByUserId?: string | null,
): Promise<SyncResult> {
  const sb = getSupabaseAdmin();

  const { data: lead, error: leadErr } = await sb
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    throw new Error(leadErr?.message ?? "Lead not found");
  }
  const typedLead = lead as Lead;

  const operation: SyncOperation = typedLead.erpnext_lead_name ? "UPDATE" : "CREATE";

  const { data: logRow, error: logErr } = await sb
    .from("erp_sync_log")
    .insert({
      lead_id: leadId,
      direction: "PUSH",
      operation,
      status: "PENDING",
      triggered_by_user_id: triggeredByUserId ?? null,
      erpnext_lead_name: typedLead.erpnext_lead_name,
    })
    .select("id")
    .single();
  if (logErr || !logRow) throw new Error(logErr?.message ?? "Failed to insert sync log");
  const logId = (logRow as { id: string }).id;

  const payload = mapLeadToErpnext(typedLead);

  try {
    let erpResult: ErpnextLead;
    if (operation === "CREATE") {
      erpResult = await erpCreateLead(payload);
    } else {
      erpResult = await erpUpdateLead(typedLead.erpnext_lead_name as string, payload);
    }

    const now = new Date().toISOString();
    await sb
      .from("leads")
      .update({
        erpnext_lead_name: erpResult.name,
        erpnext_last_synced_at: now,
      })
      .eq("id", leadId);

    await sb
      .from("erp_sync_log")
      .update({
        status: "SUCCESS",
        completed_at: now,
        erpnext_lead_name: erpResult.name,
        payload_snapshot: { request: payload, response: erpResult },
      })
      .eq("id", logId);

    await sb.from("lead_events").insert({
      lead_id: leadId,
      event_type: "ERP_SYNC",
      user_id: triggeredByUserId ?? null,
      payload: { direction: "PUSH", operation, erpnext_lead_name: erpResult.name },
    });

    return { ok: true, log_id: logId, erpnext_lead_name: erpResult.name };
  } catch (e) {
    const errorMessage =
      e instanceof ErpnextApiError
        ? `${e.message}: ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`
        : e instanceof Error
          ? e.message
          : String(e);

    await sb
      .from("erp_sync_log")
      .update({
        status: "FAILED",
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
        payload_snapshot: { request: payload },
      })
      .eq("id", logId);

    await sb.from("lead_events").insert({
      lead_id: leadId,
      event_type: "ERROR",
      user_id: triggeredByUserId ?? null,
      payload: { direction: "PUSH", operation, error: errorMessage },
    });

    return { ok: false, log_id: logId, error: errorMessage };
  }
}

export async function syncLeadFromErpnext(
  erpLeadName: string,
  triggeredByUserId?: string | null,
): Promise<SyncResult> {
  const sb = getSupabaseAdmin();

  const { data: logRow, error: logErr } = await sb
    .from("erp_sync_log")
    .insert({
      direction: "PULL",
      operation: "UPDATE",
      status: "PENDING",
      triggered_by_user_id: triggeredByUserId ?? null,
      erpnext_lead_name: erpLeadName,
    })
    .select("id")
    .single();
  if (logErr || !logRow) throw new Error(logErr?.message ?? "Failed to insert sync log");
  const logId = (logRow as { id: string }).id;

  try {
    const erp = await erpGetLead(erpLeadName);
    const mapped = mapErpnextToLead(erp);

    const { data: existing } = await sb
      .from("leads")
      .select("id")
      .eq("erpnext_lead_name", erpLeadName)
      .maybeSingle();

    let leadId: string;
    let op: SyncOperation;

    if (existing?.id) {
      leadId = (existing as { id: string }).id;
      op = "UPDATE";
      await sb.from("leads").update(mapped).eq("id", leadId);
    } else {
      op = "CREATE";
      const { data: inserted, error: insErr } = await sb
        .from("leads")
        .insert(mapped)
        .select("id")
        .single();
      if (insErr || !inserted) throw new Error(insErr?.message ?? "insert failed");
      leadId = (inserted as { id: string }).id;
    }

    const now = new Date().toISOString();
    await sb
      .from("erp_sync_log")
      .update({
        status: "SUCCESS",
        completed_at: now,
        operation: op,
        lead_id: leadId,
        payload_snapshot: { response: erp },
      })
      .eq("id", logId);

    await sb.from("lead_events").insert({
      lead_id: leadId,
      event_type: "ERP_SYNC",
      user_id: triggeredByUserId ?? null,
      payload: { direction: "PULL", operation: op, erpnext_lead_name: erpLeadName },
    });

    return { ok: true, log_id: logId, erpnext_lead_name: erpLeadName };
  } catch (e) {
    const errorMessage =
      e instanceof ErpnextApiError
        ? `${e.message}: ${typeof e.body === "string" ? e.body : JSON.stringify(e.body)}`
        : e instanceof Error
          ? e.message
          : String(e);
    await sb
      .from("erp_sync_log")
      .update({
        status: "FAILED",
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq("id", logId);
    return { ok: false, log_id: logId, error: errorMessage };
  }
}

export interface PullSummary {
  fetched: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export async function pullUpdatedSince(
  since: Date,
  triggeredByUserId?: string | null,
): Promise<PullSummary> {
  const summary: PullSummary = { fetched: 0, succeeded: 0, failed: 0, errors: [] };
  let offset = 0;
  const pageSize = 50;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await erpListLeads({ updated_after: since, limit: pageSize, offset });
    if (batch.length === 0) break;
    summary.fetched += batch.length;
    for (const erp of batch) {
      const res = await syncLeadFromErpnext(erp.name, triggeredByUserId);
      if (res.ok) summary.succeeded++;
      else {
        summary.failed++;
        if (res.error) summary.errors.push(`${erp.name}: ${res.error}`);
      }
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return summary;
}

export type { ErpSyncLog };