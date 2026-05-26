import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  RefreshCw,
  Settings,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/sync/logs", label: "ERP Sync Logs", icon: RefreshCw },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      <aside className="w-60 border-r border-neutral-200 bg-white">
        <div className="px-5 py-5 text-sm font-semibold tracking-tight">
          Lead Ops
        </div>
        <nav className="px-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            if (item.disabled) {
              return (
                <div
                  key={item.to}
                  className="flex items-center gap-2 rounded px-3 py-2 text-sm text-neutral-400"
                  title="Coming in Phase 2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  <span className="ml-auto text-[10px] uppercase tracking-wide">soon</span>
                </div>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors " +
                  (active
                    ? "bg-neutral-100 font-medium text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900")
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
          <div className="text-sm text-neutral-500">Single-tenant CRM workspace</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-600">{user?.email}</span>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
              className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}