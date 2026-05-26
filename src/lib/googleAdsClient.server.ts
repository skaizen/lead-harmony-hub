import { serverEnv } from "./supabase/admin.server";

// Minimal Google Ads API client using REST + OAuth refresh token flow.
// Docs: https://developers.google.com/google-ads/api/rest/overview

export function hasGoogleAdsConfig(): boolean {
  return Boolean(
    serverEnv("GOOGLE_ADS_DEVELOPER_TOKEN") &&
      serverEnv("GOOGLE_ADS_CLIENT_ID") &&
      serverEnv("GOOGLE_ADS_CLIENT_SECRET") &&
      serverEnv("GOOGLE_ADS_REFRESH_TOKEN") &&
      serverEnv("GOOGLE_ADS_CUSTOMER_ID"),
  );
}

async function getAccessToken(): Promise<string> {
  const clientId = serverEnv("GOOGLE_ADS_CLIENT_ID")!;
  const clientSecret = serverEnv("GOOGLE_ADS_CLIENT_SECRET")!;
  const refreshToken = serverEnv("GOOGLE_ADS_REFRESH_TOKEN")!;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Google OAuth error: ${json.error_description ?? json.error ?? res.status}`);
  }
  return json.access_token;
}

export interface GoogleAdsInsightRow {
  date: string;
  campaign_id: string;
  ad_group_id?: string;
  impressions: number;
  clicks: number;
  spend: number; // currency units
  conversions: number;
}

export async function fetchGoogleAdsInsights(opts: {
  daysBack?: number;
}): Promise<GoogleAdsInsightRow[]> {
  if (!hasGoogleAdsConfig()) throw new Error("Missing Google Ads env vars");
  const customerId = serverEnv("GOOGLE_ADS_CUSTOMER_ID")!.replace(/-/g, "");
  const loginCustomerId = serverEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")?.replace(/-/g, "");
  const developerToken = serverEnv("GOOGLE_ADS_DEVELOPER_TOKEN")!;
  const token = await getAccessToken();
  const days = opts.daysBack ?? 30;
  const query = `
    SELECT segments.date, campaign.id, ad_group.id,
           metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM ad_group
    WHERE segments.date DURING LAST_${days}_DAYS
  `.replace(/\s+/g, " ").trim();

  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "developer-token": developerToken,
    "content-type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Ads error ${res.status}: ${text}`);
  // searchStream returns a JSON array of batches.
  const batches = JSON.parse(text) as Array<{ results?: Array<Record<string, unknown>> }>;
  const out: GoogleAdsInsightRow[] = [];
  for (const batch of batches) {
    for (const r of batch.results ?? []) {
      const segments = r.segments as { date?: string } | undefined;
      const campaign = r.campaign as { id?: string } | undefined;
      const adGroup = r.adGroup as { id?: string } | undefined;
      const metrics = r.metrics as {
        impressions?: string; clicks?: string; costMicros?: string; conversions?: number;
      } | undefined;
      if (!segments?.date || !campaign?.id) continue;
      out.push({
        date: segments.date,
        campaign_id: String(campaign.id),
        ad_group_id: adGroup?.id ? String(adGroup.id) : undefined,
        impressions: Number(metrics?.impressions ?? 0),
        clicks: Number(metrics?.clicks ?? 0),
        spend: Number(metrics?.costMicros ?? 0) / 1_000_000,
        conversions: Number(metrics?.conversions ?? 0),
      });
    }
  }
  return out;
}