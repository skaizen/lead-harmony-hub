import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  RefreshCw,
  Settings,
  LogOut,
  Zap,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";

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
  const [open, setOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Edge-swipe-right to open (when closed); swipe-left on drawer to close
  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };
  const onTouchMove = (e: TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
  };
  const onTouchEnd = () => {
    const start = touchStartX.current;
    const end = touchCurrentX.current;
    touchStartX.current = null;
    touchCurrentX.current = null;
    if (start == null || end == null) return;
    const dx = end - start;
    if (!open && start < 24 && dx > 60) setOpen(true);
    if (open && dx < -60) setOpen(false);
  };

  const initials = (user?.email ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();
  const current =
    NAV.find((n) =>
      n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to),
    )?.label ?? "Overview";

  const sidebar = (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-solar text-solar-foreground">
              <Zap className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <h1 className="font-display text-xl font-bold uppercase tracking-tight text-foreground">
              Lead Ops
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-4">
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
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground/60"
                title="Coming in Phase 2"
              >
                <Icon className="h-5 w-5" />
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
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors " +
                (active
                  ? "bg-sidebar-accent font-medium text-solar"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground")
              }
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-background p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sustain text-xs font-bold text-sustain-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.email ?? "—"}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Admin
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="flex min-h-screen bg-background text-foreground"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-border bg-sidebar md:flex">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <div
        className={
          "fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-2xl transition-transform duration-300 md:hidden " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
        aria-hidden={!open}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-sidebar px-4 shadow-md md:px-8">
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="hidden text-muted-foreground sm:inline">Dashboard</span>
              <span className="hidden text-muted-foreground/50 sm:inline">/</span>
              <span className="font-medium text-foreground">{current}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}