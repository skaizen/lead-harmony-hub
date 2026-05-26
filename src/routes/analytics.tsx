import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { Guarded } from "@/components/Guarded";
import { useAuth } from "@/lib/auth-context";
import { getAnalyticsSummary } from "@/lib/ads.functions";

export const Route = createFileRoute("/analytics")({
  component: () => (
    <Guarded>
      <AnalyticsPage />
    </Guarded>
  ),
});

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#8b5cf6", "#0ea5e9"];

function AnalyticsPage() {
  const { accessToken } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", accessToken],
    queryFn: () => getAnalyticsSummary({ data: { accessToken, days: 30 } }),
    enabled: !!accessToken,
  });

  if (isLoading) return <div className="text-sm text-neutral-500">Loading analytics…</div>;
  if (error) return <div className="text-sm text-red-600">{(error as Error).message}</div>;
  if (!data) return null;

  const t = data.totals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-neutral-500">Last 30 days across leads + ad spend.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Leads" value={t.leads} />
        <Stat label="Meta spend" value={`$${t.metaSpend.toFixed(2)}`} />
        <Stat label="Google spend" value={`$${t.googleSpend.toFixed(2)}`} />
        <Stat label="Total clicks" value={t.metaClicks + t.googleClicks} />
      </div>

      <Card title="Leads per day">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.leadsByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Leads by source">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.bySource} dataKey="count" nameKey="source" outerRadius={80} label>
                {data.bySource.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Leads by status">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Ad spend per day">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.spendByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="meta" stackId="s" fill="#2563eb" />
            <Bar dataKey="google" stackId="s" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-700">{title}</h2>
      {children}
    </div>
  );
}