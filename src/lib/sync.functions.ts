import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/admin.server";
import {
  pullUpdatedSince,
  syncLeadToErpnext,
} from "@/lib/leadSyncService.server";
import { requireUser } from "./auth.functions";
import type { ErpSyncLog, SyncDirection, SyncStatus } from "@/lib/types";

export const pushLeadToErpnext = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null; leadId: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    return await syncLeadToErpnext(data.leadId, user.id);
  });

export const pullFromErpnext = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null; sinceIso?: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const since = data.sinceIso ? new Date(data.sinceIso) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await pullUpdatedSince(since, user.id);
  });

export interface ListLogsInput {
  accessToken: string | null;
  statuses?: SyncStatus[];
  directions?: SyncDirection[];
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

export const listSyncLogs = createServerFn({ method: "POST" })
  .inputValidator((d: ListLogsInput) => d)
  .handler(async ({ data }) => {
    await requireUser(data.accessToken);
    const sb = getSupabaseAdmin();
    const page = data.page ?? 0;
    const pageSize = data.pageSize ?? 50;
    let q = sb
      .from("erp_sync_log")
      .select("*", { count: "exact" })
      .order("requested_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (data.statuses?.length) q = q.in("status", data.statuses);
    if (data.directions?.length) q = q.in("direction", data.directions);
    if (data.from) q = q.gte("requested_at", data.from);
    if (data.to) q = q.lte("requested_at", data.to);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as ErpSyncLog[], total: count ?? 0, page, pageSize };
  });

export const checkEnv = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null }) => d)
  .handler(async ({ data }) => {
    await requireUser(data.accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;
    const names = [
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "EXT_SUPABASE_URL",
      "EXT_SUPABASE_SERVICE_KEY",
      "ERPNEXT_BASE_URL",
      "ERPNEXT_API_KEY",
      "ERPNEXT_API_SECRET",
      "WORDPRESS_WEBHOOK_SECRET",
      "META_ACCESS_TOKEN",
      "META_AD_ACCOUNT_ID",
      "GOOGLE_ADS_DEVELOPER_TOKEN",
      "GOOGLE_ADS_CLIENT_ID",
      "GOOGLE_ADS_CLIENT_SECRET",
      "GOOGLE_ADS_REFRESH_TOKEN",
      "GOOGLE_ADS_CUSTOMER_ID",
    ];
    return names.map((n) => ({ name: n, present: Boolean(env[n]) }));
  });

export const checkErpnextConfig = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null }) => d)
  .handler(async ({ data }) => {
    await requireUser(data.accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;
    const configured =
      Boolean(env["ERPNEXT_BASE_URL"]) &&
      Boolean(env["ERPNEXT_API_KEY"]) &&
      Boolean(env["ERPNEXT_API_SECRET"]);
    return { configured };
  });