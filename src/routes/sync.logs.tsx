import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Guarded } from "@/components/Guarded";
import { useAuth } from "@/lib/auth-context";
import { listSyncLogs } from "@/lib/sync.functions";
import type { ErpSyncLog, SyncDirection, SyncStatus } from "@/lib/types";

export const Route = createFileRoute("/sync/logs")({
  component: () => (
    <Guarded>
      <SyncLogsPage />
    </Guarded>
  ),
});

const STATUSES: SyncStatus[] = ["PENDING", "SUCCESS", "FAILED"];
const DIRECTIONS: SyncDirection[] = ["PUSH", "PULL"];

function SyncLogsPage() {
  const { accessToken } = useAuth();
  const [statuses, setStatuses] = useState<SyncStatus[]>([]);
  const [directions, setDirections] = useState<SyncDirection[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [drawer, setDrawer] = useState<ErpSyncLog | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sync-logs", accessToken, statuses, directions, from, to, page],
    queryFn: () =>
      listSyncLogs({
        data: {
          accessToken,
          statuses: statuses.length ? statuses : undefined,
          directions: directions.length ? directions : undefined,
          from: from || null,
          to: to || null,
          page,
          pageSize: 50,
        },
      }),
    enabled: !!accessToken,
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ERP Sync Logs</h1>
        <p className="text-sm text-muted-foreground">{total} entries</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <Pills label="Status" values={STATUSES} selected={statuses} onChange={(v) => { setStatuses(v as SyncStatus[]); setPage(0); }} />
          <Pills label="Direction" values={DIRECTIONS} selected={directions} onChange={(v) => { setDirections(v as SyncDirection[]); setPage(0); }} />
          <label className="flex flex-col">
            <span className="text-xs text-muted-foreground">From</span>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="rounded border border-border px-2 py-1" />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-muted-foreground">To</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="rounded border border-border px-2 py-1" />
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Requested</th>
              <th className="px-3 py-2 text-left">Direction</th>
              <th className="px-3 py-2 text-left">Operation</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Lead</th>
              <th className="px-3 py-2 text-left">ERP Name</th>
              <th className="px-3 py-2 text-left">Completed</th>
              <th className="px-3 py-2 text-left">Error</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground/70">Loading…</td></tr>}
            {error && <tr><td colSpan={8} className="px-3 py-6 text-center text-red-600">{(error as Error).message}</td></tr>}
            {!isLoading && data?.rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground/70">No sync log entries yet.</td></tr>
            )}
            {data?.rows.map((log) => (
              <tr key={log.id} className="cursor-pointer border-t border-border hover:bg-muted" onClick={() => setDrawer(log)}>
                <td className="px-3 py-2 text-foreground/80">{new Date(log.requested_at).toLocaleString()}</td>
                <td className="px-3 py-2">{log.direction}</td>
                <td className="px-3 py-2">{log.operation}</td>
                <td className="px-3 py-2">
                  <span className={
                    log.status === "SUCCESS" ? "text-emerald-600" :
                    log.status === "FAILED" ? "text-red-600" :
                    "text-muted-foreground"
                  }>{log.status}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{log.lead_id ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{log.erpnext_lead_name ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{log.completed_at ? new Date(log.completed_at).toLocaleString() : "—"}</td>
                <td className="px-3 py-2 text-xs text-red-700">{log.error_message ? log.error_message.slice(0, 60) + (log.error_message.length > 60 ? "…" : "") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {page + 1} of {pages}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Prev</button>
          <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawer(null)}>
          <div className="flex-1 bg-black/30" />
          <div className="w-full max-w-xl overflow-auto bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Sync log detail</h2>
              <button onClick={() => setDrawer(null)} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Info label="Direction" value={drawer.direction} />
              <Info label="Operation" value={drawer.operation} />
              <Info label="Status" value={drawer.status} />
              <Info label="Requested" value={new Date(drawer.requested_at).toLocaleString()} />
              <Info label="Completed" value={drawer.completed_at ? new Date(drawer.completed_at).toLocaleString() : "—"} />
              <Info label="ERP Lead" value={drawer.erpnext_lead_name ?? "—"} />
            </dl>
            {drawer.error_message && (
              <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {drawer.error_message}
              </div>
            )}
            <div className="mt-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">payload_snapshot</div>
              <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-[11px] text-foreground">
                {JSON.stringify(drawer.payload_snapshot ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pills({
  label, values, selected, onChange,
}: { label: string; values: readonly string[]; selected: string[]; onChange: (n: string[]) => void }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1 pt-1">
        {values.map((v) => {
          const on = selected.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(on ? selected.filter((s) => s !== v) : [...selected, v])}
              className={
                "rounded-full border px-2 py-0.5 text-xs " +
                (on ? "border-solar bg-solar text-solar-foreground" : "border-border text-foreground/80 hover:bg-muted")
              }
            >{v}</button>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}