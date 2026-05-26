import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Guarded } from "@/components/Guarded";
import { useAuth } from "@/lib/auth-context";
import { getLead, updateLead } from "@/server/leads";
import { pushLeadToErpnext } from "@/server/sync";
import type { Lead, LeadStatus } from "@/lib/types";

export const Route = createFileRoute("/leads/$id")({
  component: () => (
    <Guarded>
      <LeadDetailPage />
    </Guarded>
  ),
});

const STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Converted", "Lost"];

function LeadDetailPage() {
  const { id } = useParams({ from: "/leads/$id" });
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["lead", id, accessToken],
    queryFn: () => getLead({ data: { accessToken, id } }),
    enabled: !!accessToken,
  });

  const [form, setForm] = useState<Partial<Lead>>({});
  useEffect(() => {
    if (data?.lead) {
      const l = data.lead;
      setForm({
        first_name: l.first_name,
        last_name: l.last_name,
        email: l.email,
        phone: l.phone,
        company_name: l.company_name,
        status: l.status,
        owner: l.owner,
        notes: l.notes,
      });
    }
  }, [data?.lead]);

  const save = useMutation({
    mutationFn: () => updateLead({ data: { accessToken, id, patch: form } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["lead", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: () => pushLeadToErpnext({ data: { accessToken, leadId: id } }),
    onSuccess: (res) => {
      if (res.ok) toast.success(`Synced to ERPNext: ${res.erpnext_lead_name}`);
      else toast.error(`Sync failed: ${res.error}`);
      qc.invalidateQueries({ queryKey: ["lead", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-neutral-500">Loading…</div>;
  if (error) return <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{(error as Error).message}</div>;
  if (!data) return null;

  const lead = data.lead;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/leads" className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700">
            <ArrowLeft className="h-3 w-3" /> Back to leads
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unnamed lead"}
          </h1>
          <p className="text-xs text-neutral-500">Created {new Date(lead.created_at).toLocaleString()}</p>
        </div>
        <button
          type="button"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="inline-flex items-center gap-2 rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          <RefreshCw className={"h-4 w-4 " + (sync.isPending ? "animate-spin" : "")} />
          Sync to ERPNext
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <Panel title="Lead details">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="First name" value={form.first_name ?? ""} onChange={(v) => setForm({ ...form, first_name: v })} />
              <Field label="Last name" value={form.last_name ?? ""} onChange={(v) => setForm({ ...form, last_name: v })} />
              <Field label="Email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Company" value={form.company_name ?? ""} onChange={(v) => setForm({ ...form, company_name: v })} />
              <Field label="Owner" value={form.owner ?? ""} onChange={(v) => setForm({ ...form, owner: v })} />
              <label className="col-span-1 flex flex-col text-sm">
                <span className="text-xs text-neutral-500">Status</span>
                <select
                  value={form.status ?? "New"}
                  onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                  className="mt-1 rounded border border-neutral-200 px-2 py-1.5"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="col-span-2 flex flex-col text-sm">
                <span className="text-xs text-neutral-500">Notes</span>
                <textarea
                  rows={3}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 rounded border border-neutral-200 px-2 py-1.5"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </Panel>

          <Panel title="Attribution">
            <ReadGrid items={{
              utm_source: lead.utm_source,
              utm_medium: lead.utm_medium,
              utm_campaign: lead.utm_campaign,
              utm_term: lead.utm_term,
              utm_content: lead.utm_content,
            }} />
          </Panel>

          <Panel title="Channel IDs">
            <ReadGrid items={{
              google_ads_campaign_id: lead.google_ads_campaign_id,
              google_ads_ad_group_id: lead.google_ads_ad_group_id,
              google_ads_ad_id: lead.google_ads_ad_id,
              meta_campaign_id: lead.meta_campaign_id,
              meta_adset_id: lead.meta_adset_id,
              meta_ad_id: lead.meta_ad_id,
              wordpress_form_id: lead.wordpress_form_id,
              external_id: lead.external_id,
            }} />
          </Panel>

          <Panel title="ERPNext linkage">
            <ReadGrid items={{
              erpnext_lead_name: lead.erpnext_lead_name,
              erpnext_last_synced_at: lead.erpnext_last_synced_at,
            }} />
          </Panel>
        </section>

        <aside className="space-y-4">
          <Panel title="Timeline">
            {data.events.length === 0 && <div className="text-sm text-neutral-400">No events yet.</div>}
            <ul className="space-y-3">
              {data.events.map((e) => (
                <li key={e.id} className="border-l-2 border-neutral-200 pl-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-neutral-800">{e.event_type}</span>
                    <span className="text-xs text-neutral-400">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  {e.payload && (
                    <pre className="mt-1 overflow-auto rounded bg-neutral-50 p-2 text-[11px] text-neutral-600">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recent sync log">
            {data.logs.length === 0 && <div className="text-sm text-neutral-400">No sync attempts yet.</div>}
            <ul className="space-y-2 text-sm">
              {data.logs.map((l) => {
                const log = l as { id: string; status: string; direction: string; operation: string; requested_at: string; error_message: string | null };
                return (
                  <li key={log.id} className="rounded border border-neutral-100 p-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{log.direction} · {log.operation}</span>
                      <span className={
                        log.status === "SUCCESS" ? "text-emerald-600" :
                        log.status === "FAILED" ? "text-red-600" : "text-neutral-500"
                      }>{log.status}</span>
                    </div>
                    <div className="text-xs text-neutral-400">{new Date(log.requested_at).toLocaleString()}</div>
                    {log.error_message && <div className="mt-1 text-xs text-red-700">{log.error_message}</div>}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </aside>
      </div>
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col text-sm">
      <span className="text-xs text-neutral-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 rounded border border-neutral-200 px-2 py-1.5" />
    </label>
  );
}

function ReadGrid({ items }: { items: Record<string, string | null> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {Object.entries(items).map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">{k}</dt>
          <dd className="text-neutral-800">{v ?? <span className="text-neutral-300">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}