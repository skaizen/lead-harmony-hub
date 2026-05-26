import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, user, loading, configured } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) setErr(error);
    else if (mode === "signup") setMsg("Check your email to confirm, then sign in.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Lead Ops</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to your dashboard" : "Create an account"}
        </p>
        {!configured && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Supabase env vars not set. Login will not work until VITE_SUPABASE_URL +
            VITE_SUPABASE_ANON_KEY are configured.
          </div>
        )}
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="text-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-border px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="text-foreground">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-border px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
            />
          </label>
          {err && <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{err}</div>}
          {msg && <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{msg}</div>}
          <button
            type="submit"
            disabled={busy || !configured}
            className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setErr(null);
            setMsg(null);
          }}
          className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}