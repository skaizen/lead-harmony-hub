import { serverEnv } from "./supabase/admin.server";

// Minimal Meta Marketing API client. Reads insights at campaign level.
// Docs: https://developers.facebook.com/docs/marketing-api/insights

export interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  campaign_id: string;
  adset_id?: string;
  ad_id?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: { action_type: string; value: string }[];
}

export function hasMetaConfig(): boolean {
  return Boolean(serverEnv("META_ACCESS_TOKEN") && serverEnv("META_AD_ACCOUNT_ID"));
}

export async function fetchMetaInsights(opts: {
  datePreset?: string;
  level?: "campaign" | "adset" | "ad";
}): Promise<MetaInsightRow[]> {
  const token = serverEnv("META_ACCESS_TOKEN");
  const accountId = serverEnv("META_AD_ACCOUNT_ID");
  if (!token || !accountId) {
    throw new Error("Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID");
  }
  const apiVersion = serverEnv("META_API_VERSION") ?? "v19.0";
  const accountPath = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const level = opts.level ?? "campaign";
  const fields = [
    "campaign_id",
    "adset_id",
    "ad_id",
    "impressions",
    "clicks",
    "spend",
    "actions",
  ].join(",");
  const url = new URL(`https://graph.facebook.com/${apiVersion}/${accountPath}/insights`);
  url.searchParams.set("level", level);
  url.searchParams.set("fields", fields);
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("date_preset", opts.datePreset ?? "last_30d");
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", token);

  const rows: MetaInsightRow[] = [];
  let next: string | null = url.toString();
  while (next) {
    const res = await fetch(next);
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) {
      throw new Error(`Meta Insights error ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    }
    const parsed = body as { data?: MetaInsightRow[]; paging?: { next?: string } };
    rows.push(...(parsed.data ?? []));
    next = parsed.paging?.next ?? null;
  }
  return rows;
}