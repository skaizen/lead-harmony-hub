import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Guarded } from "@/components/Guarded";
import { useAuth } from "@/lib/auth-context";
import { createLead, listLeads } from "@/lib/leads.functions";
import { checkErpnextConfig, pushLeadToErpnext } from "@/lib/sync.functions";
import type { LeadSource, LeadStatus } from "@/lib/types";
import { CheckCircle2, Circle, Plus, RefreshCw, X } from "lucide-react";

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
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  // Track per-row sync pending state by lead ID
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  const { data: erpConfig } = useQuery({
    queryKey: ["erpnext-config", accessToken],
    queryFn: () => checkErpnextConfig({ data: { accessToken } }),
    enabled: !!accessToken,
    staleTime: 60_000,
  });
  const erpConfigured = erpConfig?.configured ?? false;

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

  const syncLead = useCallback(async (leadId: string) => {
    setSyncingIds((prev) => new Set(prev).add(leadId));
    try {
      const res = await pushLeadToErpnext({ data: { accessToken, leadId } });
      if (res.ok) toast.success("Synced to ERPNext");
      else toast.error(`Sync failed: ${res.error ?? "unknown"}`);
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncingIds((prev) => { const s = new Set(prev); s.delete(leadId); return s; });
    }
  }, [accessToken, qc]);

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          <Plus className="h-4 w-4" />
          New Lead
        </button>
      </div>

      {showCreate && (
        <CreateLeadModal
          accessToken={accessToken}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["leads"] });
            navigate({ to: "/leads/$id", params: { id } });
          }}
        />
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <MultiSelect label="Source" values={SOURCES} selected={sources} onChange={(v) => { setSources(v as LeadSource[]); setPage(0); }} />
          <MultiSelect label="Status" values={STATUSES} selected={statuses} onChange={(v) => { setStatuses(v as LeadStatus[]); setPage(0); }} />
          <label className="flex flex-col">
            <span className="text-xs text-muted-foreground">From</span>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="rounded border border-border px-2 py-1" />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-muted-foreground">To</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="rounded border border-border px-2 py-1" />
          </label>
          {(sources.length || statuses.length || from || to) ? (
            <button
              type="button"
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setSources([]); setStatuses([]); setFrom(""); setTo(""); setPage(0); }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
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
              <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground/70">Loading…</td></tr>
            )}
            {error && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-red-600">{(error as Error).message}</td></tr>
            )}
            {!isLoading && data?.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No leads found.</p>
                  <div className="mt-3 flex justify-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowCreate(true)}
                      className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" /> Create one manually
                    </button>
                    <Link to="/settings" className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 hover:bg-muted">
                      Pull from ERPNext
                    </Link>
                  </div>
                </td>
              </tr>
            )}
            {data?.rows.map((l) => {
              const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 text-foreground/80">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 font-medium">{name}</td>
                  <td className="px-3 py-2 text-foreground/80">{l.email ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground/80">{l.phone ?? "—"}</td>
                  <td className="px-3 py-2"><Badge>{l.source}</Badge></td>
                  <td className="px-3 py-2"><Badge tone={statusTone(l.status)}>{l.status}</Badge></td>
                  <td className="px-3 py-2">
                    {l.erpnext_lead_name ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700" title={l.erpnext_last_synced_at ?? undefined}>
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">{l.erpnext_lead_name}</span>
                      </span>
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to="/leads/$id" params={{ id: l.id }} className="text-xs text-foreground underline-offset-2 hover:underline">View</Link>
                      <button
                        type="button"
                        disabled={syncingIds.has(l.id) || !erpConfigured}
                        onClick={() => syncLead(l.id)}
                        title={!erpConfigured ? "ERPNext not configured — add ERPNEXT_BASE_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET to .env" : "Push lead to ERPNext"}
                        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        <RefreshCw className={"h-3 w-3 " + (syncingIds.has(l.id) ? "animate-spin" : "")} />
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

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {page + 1} of {pages}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Prev</button>
          <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
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
    neutral: "bg-muted text-foreground",
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

function CreateLeadModal({
  accessToken,
  onClose,
  onCreated,
}: {
  accessToken: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    status: "New" as LeadStatus,
    source: "manual" as LeadSource,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const lead = await createLead({ data: { accessToken, lead: form } });
      toast.success("Lead created");
      onCreated((lead as { id: string }).id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New Lead</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col">
              <span className="text-xs text-neutral-500">First name</span>
              <input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="mt-1 rounded border border-neutral-200 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-neutral-500">Last name</span>
              <input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="mt-1 rounded border border-neutral-200 px-2 py-1.5"
              />
            </label>
          </div>
          <label className="flex flex-col">
            <span className="text-xs text-neutral-500">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 rounded border border-neutral-200 px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-neutral-500">Phone</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 rounded border border-neutral-200 px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-neutral-500">Company</span>
            <input
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className="mt-1 rounded border border-neutral-200 px-2 py-1.5"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-neutral-500">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
              className="mt-1 rounded border border-neutral-200 px-2 py-1.5"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {err && <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}