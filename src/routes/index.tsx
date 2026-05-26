import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Guarded } from "@/components/Guarded";
import { useAuth } from "@/lib/auth-context";
import { getOverviewStats } from "@/server/leads";

export const Route = createFileRoute("/")({
  component: () => (
    <Guarded>
      <Overview />
    </Guarded>
  ),
});

function Overview() {
  const { accessToken } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["overview", accessToken],
    queryFn: () => getOverviewStats({ data: { accessToken } }),
    enabled: !!accessToken,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-neutral-500">High-level metrics from your lead database.</p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Total leads" value={isLoading ? "…" : (data?.total ?? 0)} />
        <Card label="Last 30 days" value={isLoading ? "…" : (data?.last30Days ?? 0)} />
        <Card label="Sources" value={isLoading ? "…" : Object.keys(data?.bySource ?? {}).length} />
        <Card label="Statuses" value={isLoading ? "…" : Object.keys(data?.byStatus ?? {}).length} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="By status">
          <Distribution data={data?.byStatus ?? {}} />
        </Panel>
        <Panel title="By source">
          <Distribution data={data?.bySource ?? {}} />
        </Panel>
      </div>

      <p className="text-xs text-neutral-400">
        Charts and time-series analytics ship in Phase 2.
      </p>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 text-sm font-medium text-neutral-700">{title}</div>
      {children}
    </div>
  );
}

function Distribution({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <div className="text-sm text-neutral-400">No data</div>;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-700">{k}</span>
            <span className="text-neutral-500">{v}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded bg-neutral-100">
            <div
              className="h-1.5 rounded bg-neutral-800"
              style={{ width: `${max ? (v / max) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
