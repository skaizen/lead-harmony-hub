import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Guarded } from "@/components/Guarded";
import { useAuth } from "@/lib/auth-context";
import { listLeads } from "@/server/leads";
import { pushLeadToErpnext } from "@/server/sync";
import type { LeadSource, LeadStatus } from "@/lib/types";
import { CheckCircle2, Circle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/leads/")({
  component: () => (
    <Guarded>
      <LeadsPage />
    </Guarded>
  ),
});

const SOURCES: LeadSource[] = ["erpnext", "google_ads", "meta_ads", "wordpress", "manual"];
const STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Converted", "Lost"];

function LeadsPage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["leads", accessToken, sources, statuses, from, to, page],
    queryFn: () =>
      listLeads({
        data: {
          accessToken,
          sources: sources.length ? sources : undefined,
          statuses: statuses.length ? statuses : undefined,
          from: from || null,
          to: to || null,
          page,
          pageSize: 25,
        },
      }),
    enabled: !!accessToken,
  });

  const sync = useMutation({
    mutationFn: (leadId: string) =>
      pushLeadToErpnext({ data: { accessToken, leadId } }),
    onSuccess: (res) => {
      if (res.ok) toast.success("Synced to ERPNext");
      else toast.error(`Sync failed: ${res.error ?? "unknown"}`);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-neutral-500">{total} total</p>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <MultiSelect label="Source" values={SOURCES} selected={sources} onChange={(v) => { setSources(v as LeadSource[]); setPage(0); }} />
          <MultiSelect label="Status" values={STATUSES} selected={statuses} onChange={(v) => { setStatuses(v as LeadStatus[]); setPage(0); }} />
          <label className="flex flex-col">
            <span className="text-xs text-neutral-500">From</span>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="rounded border border-neutral-200 px-2 py-1" />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-neutral-500">To</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="rounded border border-neutral-200 px-2 py-1" />
          </label>
          {(sources.length || statuses.length || from || to) ? (
            <button
              type="button"
              className="ml-auto text-xs text-neutral-500 hover:text-neutral-700"
              onClick={() => { setSources([]); setStatuses([]); setFrom(""); setTo(""); setPage(0); }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">ERP</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Loading…</td></tr>
            )}
            {error && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-red-600">{(error as Error).message}</td></tr>
            )}
            {!isLoading && data?.rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">No leads yet.</td></tr>
            )}
            {data?.rows.map((l) => {
              const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";
              return (
                <tr key={l.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2 text-neutral-600">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 font-medium">{name}</td>
                  <td className="px-3 py-2 text-neutral-600">{l.email ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-600">{l.phone ?? "—"}</td>
                  <td className="px-3 py-2"><Badge>{l.source}</Badge></td>
                  <td className="px-3 py-2"><Badge tone={statusTone(l.status)}>{l.status}</Badge></td>
                  <td className="px-3 py-2">
                    {l.erpnext_lead_name ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700" title={l.erpnext_last_synced_at ?? undefined}>
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">{l.erpnext_lead_name}</span>
                      </span>
                    ) : (
                      <Circle className="h-4 w-4 text-neutral-300" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to="/leads/$id" params={{ id: l.id }} className="text-xs text-neutral-700 underline-offset-2 hover:underline">View</Link>
                      <button
                        type="button"
                        disabled={sync.isPending}
                        onClick={() => sync.mutate(l.id)}
                        className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
                      >
                        <RefreshCw className={"h-3 w-3 " + (sync.isPending ? "animate-spin" : "")} />
                        Sync
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Page {page + 1} of {pages}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-neutral-200 px-2 py-1 disabled:opacity-40">Prev</button>
          <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded border border-neutral-200 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

function MultiSelect({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-neutral-500">{label}</span>
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
                (on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")
              }
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blue" | "green" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    neutral: "bg-neutral-100 text-neutral-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
  };
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

function statusTone(s: LeadStatus): "neutral" | "blue" | "green" | "red" | "amber" {
  switch (s) {
    case "New": return "blue";
    case "Contacted": return "amber";
    case "Qualified": return "amber";
    case "Converted": return "green";
    case "Lost": return "red";
    default: return "neutral";
  }
}