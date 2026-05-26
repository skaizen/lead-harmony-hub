import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Guarded } from "@/components/Guarded";
import { useAuth } from "@/lib/auth-context";
import { checkEnv, pullFromErpnext } from "@/lib/sync.functions";
import { pullMetaAds, pullGoogleAds } from "@/lib/ads.functions";

export const Route = createFileRoute("/settings")({
  component: () => (
    <Guarded>
      <SettingsPage />
    </Guarded>
  ),
});

function SettingsPage() {
  const { accessToken } = useAuth();
  const { data: envStatus } = useQuery({
    queryKey: ["env", accessToken],
    queryFn: () => checkEnv({ data: { accessToken } }),
    enabled: !!accessToken,
  });

  const pull = useMutation({
    mutationFn: () => pullFromErpnext({ data: { accessToken } }),
    onSuccess: (s) => toast.success(`Fetched ${s.fetched}, succeeded ${s.succeeded}, failed ${s.failed}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const pullMeta = useMutation({
    mutationFn: () => pullMetaAds({ data: { accessToken } }),
    onSuccess: (s) => toast.success(`Meta: fetched ${s.fetched}, upserted ${s.upserted}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const pullGoogle = useMutation({
    mutationFn: () => pullGoogleAds({ data: { accessToken } }),
    onSuccess: (s) => toast.success(`Google Ads: fetched ${s.fetched}, upserted ${s.upserted}`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Read-only configuration status.</p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Environment variables</h2>
        <ul className="space-y-1 text-sm">
          {envStatus?.map((e) => (
            <li key={e.name} className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
              <code className="text-xs">{e.name}</code>
              <span className={e.present ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
                {e.present ? "set" : "missing"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Public vars (<code>VITE_*</code>) live in <code>.env</code>. Server-only secrets are
          configured via Lovable's secret manager or your hosting provider.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium text-foreground">ERPNext pull</h2>
        <p className="text-xs text-muted-foreground">
          Fetch ERPNext leads modified in the last 24 hours and upsert them into Supabase.
        </p>
        <button
          type="button"
          onClick={() => pull.mutate()}
          disabled={pull.isPending}
          className="mt-3 rounded bg-solar px-3 py-1.5 text-sm font-medium text-solar-foreground hover:brightness-110 disabled:opacity-50"
        >
          {pull.isPending ? "Pulling…" : "Pull from ERPNext"}
        </button>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium text-foreground">Ad insights</h2>
        <p className="text-xs text-muted-foreground">
          Pull last-30-day insights from Meta and Google Ads into the local tables.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => pullMeta.mutate()}
            disabled={pullMeta.isPending}
            className="rounded bg-solar px-3 py-1.5 text-sm font-medium text-solar-foreground hover:brightness-110 disabled:opacity-50"
          >
            {pullMeta.isPending ? "Pulling Meta…" : "Pull Meta Ads"}
          </button>
          <button
            type="button"
            onClick={() => pullGoogle.mutate()}
            disabled={pullGoogle.isPending}
            className="rounded bg-solar px-3 py-1.5 text-sm font-medium text-solar-foreground hover:brightness-110 disabled:opacity-50"
          >
            {pullGoogle.isPending ? "Pulling Google…" : "Pull Google Ads"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium text-foreground">WordPress webhook</h2>
        <p className="text-xs text-muted-foreground">
          Post lead JSON to this URL, signed with HMAC-SHA256 of the raw body using
          <code className="mx-1">WORDPRESS_WEBHOOK_SECRET</code>, in header
          <code className="mx-1">x-wp-signature</code>.
        </p>
        <code className="mt-2 block break-all rounded bg-muted p-2 text-xs">
          POST {typeof window !== "undefined" ? window.location.origin : ""}/api/public/wp-lead
        </code>
      </section>
    </div>
  );
}