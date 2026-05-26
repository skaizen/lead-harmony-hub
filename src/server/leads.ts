import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import type { Lead, LeadEvent, LeadSource, LeadStatus } from "@/lib/types";

export interface ListLeadsInput {
  accessToken: string | null;
  sources?: LeadSource[];
  statuses?: LeadStatus[];
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

export const listLeads = createServerFn({ method: "POST" })
  .inputValidator((d: ListLeadsInput) => d)
  .handler(async ({ data }) => {
    await requireUser(data.accessToken);
    const sb = getSupabaseAdmin();
    const page = data.page ?? 0;
    const pageSize = data.pageSize ?? 25;
    let q = sb
      .from("leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (data.sources?.length) q = q.in("source", data.sources);
    if (data.statuses?.length) q = q.in("status", data.statuses);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as Lead[], total: count ?? 0, page, pageSize };
  });

export const getLead = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null; id: string }) => d)
  .handler(async ({ data }) => {
    await requireUser(data.accessToken);
    const sb = getSupabaseAdmin();
    const [leadRes, eventsRes, logsRes] = await Promise.all([
      sb.from("leads").select("*").eq("id", data.id).maybeSingle(),
      sb
        .from("lead_events")
        .select("*")
        .eq("lead_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      sb
        .from("erp_sync_log")
        .select("*")
        .eq("lead_id", data.id)
        .order("requested_at", { ascending: false })
        .limit(25),
    ]);
    if (leadRes.error) throw new Error(leadRes.error.message);
    if (!leadRes.data) throw new Error("Lead not found");
    return {
      lead: leadRes.data as Lead,
      events: (eventsRes.data ?? []) as LeadEvent[],
      logs: (logsRes.data ?? []) as unknown[],
    };
  });

export const updateLead = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { accessToken: string | null; id: string; patch: Partial<Lead> }) => d,
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const sb = getSupabaseAdmin();
    // Whitelist mutable fields.
    const allowed: (keyof Lead)[] = [
      "first_name",
      "last_name",
      "email",
      "phone",
      "company_name",
      "status",
      "owner",
      "notes",
    ];
    const clean: Record<string, unknown> = {};
    for (const k of allowed) if (k in data.patch) clean[k] = (data.patch as Record<string, unknown>)[k];

    const { data: prev } = await sb.from("leads").select("status").eq("id", data.id).maybeSingle();
    const { data: updated, error } = await sb
      .from("leads")
      .update(clean)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const events: Record<string, unknown>[] = [{ event_type: "UPDATED", payload: { changed: Object.keys(clean) } }];
    if ("status" in clean && prev && (prev as { status: string }).status !== clean.status) {
      events.push({
        event_type: "STATUS_CHANGED",
        payload: { from: (prev as { status: string }).status, to: clean.status },
      });
    }
    await sb.from("lead_events").insert(
      events.map((e) => ({ ...e, lead_id: data.id, user_id: user.id })),
    );

    return updated as Lead;
  });

export const createLead = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null; lead: Partial<Lead> }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const sb = getSupabaseAdmin();
    const payload = { source: "manual" as LeadSource, status: "New" as LeadStatus, ...data.lead };
    const { data: row, error } = await sb.from("leads").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    await sb.from("lead_events").insert({
      lead_id: (row as Lead).id,
      event_type: "CREATED",
      user_id: user.id,
      payload: { source: payload.source },
    });
    return row as Lead;
  });

// Overview stats
export const getOverviewStats = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null }) => d)
  .handler(async ({ data }) => {
    await requireUser(data.accessToken);
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [totalRes, recentRes, allStatusRes] = await Promise.all([
      sb.from("leads").select("id", { count: "exact", head: true }),
      sb.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since),
      sb.from("leads").select("status"),
    ]);
    const byStatus: Record<string, number> = {};
    for (const r of (allStatusRes.data ?? []) as { status: string }[]) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    const bySource: Record<string, number> = {};
    const { data: sourceRows } = await sb.from("leads").select("source");
    for (const r of (sourceRows ?? []) as { source: string }[]) {
      bySource[r.source] = (bySource[r.source] ?? 0) + 1;
    }
    return {
      total: totalRes.count ?? 0,
      last30Days: recentRes.count ?? 0,
      byStatus,
      bySource,
    };
  });