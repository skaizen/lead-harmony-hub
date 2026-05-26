import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "./AppShell";

export function Guarded({ children }: { children: ReactNode }) {
  const { user, loading, configured } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!configured) return;
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, configured, navigate]);

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <h2 className="text-base font-semibold">Supabase not configured</h2>
          <p className="mt-2">
            Set <code className="rounded bg-white/60 px-1">VITE_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-white/60 px-1">VITE_SUPABASE_ANON_KEY</code> in a{" "}
            <code className="rounded bg-white/60 px-1">.env</code> file at the project root,
            then restart the dev server.
          </p>
          <p className="mt-2">
            See <code className="rounded bg-white/60 px-1">.env.example</code> and the README
            for setup instructions.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}