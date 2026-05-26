import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin.server";
import { requireUser } from "./auth.functions";
import { fetchMetaInsights } from "./metaAdsClient.server";
import { fetchGoogleAdsInsights } from "./googleAdsClient.server";

export const pullMetaAds = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null; datePreset?: string }) => d)
  .handler(async ({ data }) => {
    await requireUser(data.accessToken);
    const rows = await fetchMetaInsights({ datePreset: data.datePreset, level: "campaign" });
    const sb = getSupabaseAdmin();
    const upserts = rows.map((r) => ({
      date: r.date_start,
      campaign_id: r.campaign_id,
      adset_id: r.adset_id ?? null,
      ad_id: r.ad_id ?? null,
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      spend: Number(r.spend ?? 0),
      leads:
        r.actions?.find((a) => a.action_type === "lead")?.value !== undefined
          ? Number(r.actions.find((a) => a.action_type === "lead")!.value)
          : null,
      raw: r as unknown as Record<string, unknown>,
    }));
    if (upserts.length) {
      const { error } = await sb
        .from("ad_insights_meta")
        .upsert(upserts, { onConflict: "date,campaign_id,adset_id,ad_id" });
      if (error) throw new Error(error.message);
    }
    return { fetched: rows.length, upserted: upserts.length };
  });

export const pullGoogleAds = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null; daysBack?: number }) => d)
  .handler(async ({ data }) => {
    await requireUser(data.accessToken);
    const rows = await fetchGoogleAdsInsights({ daysBack: data.daysBack });
    const sb = getSupabaseAdmin();
    const upserts = rows.map((r) => ({
      date: r.date,
      campaign_id: r.campaign_id,
      ad_group_id: r.ad_group_id ?? null,
      ad_id: null as string | null,
      impressions: r.impressions,
      clicks: r.clicks,
      spend: r.spend,
      conversions: r.conversions,
      raw: r as unknown as Record<string, unknown>,
    }));
    if (upserts.length) {
      const { error } = await sb
        .from("ad_insights_google")
        .upsert(upserts, { onConflict: "date,campaign_id,ad_group_id,ad_id" });
      if (error) throw new Error(error.message);
    }
    return { fetched: rows.length, upserted: upserts.length };
  });

const AnalyticsInput = z.object({
  accessToken: z.string().nullable(),
  days: z.number().int().min(1).max(365).default(30),
});

export const getAnalyticsSummary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AnalyticsInput.parse(d))
  .handler(async ({ data }) => {
    await requireUser(data.accessToken);
    const sb = getSupabaseAdmin();
    const since = new Date(Date.now() - data.days * 86400_000);
    const sinceIso = since.toISOString();
    const sinceDate = sinceIso.slice(0, 10);

    const [leadsRes, metaRes, googleRes] = await Promise.all([
      sb.from("leads").select("id,source,status,created_at").gte("created_at", sinceIso),
      sb.from("ad_insights_meta").select("date,impressions,clicks,spend,leads").gte("date", sinceDate),
      sb.from("ad_insights_google").select("date,impressions,clicks,spend,conversions").gte("date", sinceDate),
    ]);
    if (leadsRes.error) throw new Error(leadsRes.error.message);
    if (metaRes.error) throw new Error(metaRes.error.message);
    if (googleRes.error) throw new Error(googleRes.error.message);

    const leads = leadsRes.data ?? [];
    const meta = metaRes.data ?? [];
    const google = googleRes.data ?? [];

    const bySource: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const leadsByDay: Record<string, number> = {};
    for (const l of leads) {
      bySource[l.source] = (bySource[l.source] ?? 0) + 1;
      byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
      const day = (l.created_at as string).slice(0, 10);
      leadsByDay[day] = (leadsByDay[day] ?? 0) + 1;
    }

    const spendByDay: Record<string, { meta: number; google: number }> = {};
    for (const r of meta) {
      const d = r.date as string;
      spendByDay[d] = spendByDay[d] ?? { meta: 0, google: 0 };
      spendByDay[d].meta += Number(r.spend ?? 0);
    }
    for (const r of google) {
      const d = r.date as string;
      spendByDay[d] = spendByDay[d] ?? { meta: 0, google: 0 };
      spendByDay[d].google += Number(r.spend ?? 0);
    }

    const sum = <T extends Record<string, unknown>>(rows: T[], key: keyof T) =>
      rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

    return {
      totals: {
        leads: leads.length,
        metaSpend: sum(meta, "spend"),
        metaImpressions: sum(meta, "impressions"),
        metaClicks: sum(meta, "clicks"),
        googleSpend: sum(google, "spend"),
        googleImpressions: sum(google, "impressions"),
        googleClicks: sum(google, "clicks"),
      },
      bySource: Object.entries(bySource).map(([source, count]) => ({ source, count })),
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      leadsByDay: Object.entries(leadsByDay)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      spendByDay: Object.entries(spendByDay)
        .map(([date, v]) => ({ date, meta: Number(v.meta.toFixed(2)), google: Number(v.google.toFixed(2)) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  });