import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Guarded } from "@/components/Guarded";
import { useAuth } from "@/lib/auth-context";
import { checkEnv, pullFromErpnext } from "@/server/sync";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-500">Read-only configuration status.</p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-700">Environment variables</h2>
        <ul className="space-y-1 text-sm">
          {envStatus?.map((e) => (
            <li key={e.name} className="flex items-center justify-between border-b border-neutral-100 py-1.5 last:border-0">
              <code className="text-xs">{e.name}</code>
              <span className={e.present ? "text-emerald-600 text-xs" : "text-red-600 text-xs"}>
                {e.present ? "set" : "missing"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          Public vars (<code>VITE_*</code>) live in <code>.env</code>. Server-only secrets are
          configured via Lovable's secret manager or your hosting provider.
        </p>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-700">ERPNext pull</h2>
        <p className="text-xs text-neutral-500">
          Fetch ERPNext leads modified in the last 24 hours and upsert them into Supabase.
        </p>
        <button
          type="button"
          onClick={() => pull.mutate()}
          disabled={pull.isPending}
          className="mt-3 rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pull.isPending ? "Pulling…" : "Pull from ERPNext"}
        </button>
      </section>
    </div>
  );
}