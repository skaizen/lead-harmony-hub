import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowser, hasSupabaseBrowserConfig, loadSupabaseConfig } from "./supabase/browser";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [configured, setConfigured] = useState(hasSupabaseBrowserConfig());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    loadSupabaseConfig().then((ok) => {
      setConfigured(ok);
      if (!ok) {
        setLoading(false);
        return;
      }
      const sb = getSupabaseBrowser();
      sb.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setLoading(false);
      });
      const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
      unsub = () => sub.subscription.unsubscribe();
    });
    return () => unsub?.();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      accessToken: session?.access_token ?? null,
      configured,
      async signIn(email, password) {
        if (!configured) return { error: "Supabase env not configured" };
        const { error } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      async signUp(email, password) {
        if (!configured) return { error: "Supabase env not configured" };
        const { error } = await getSupabaseBrowser().auth.signUp({
          email,
          password,
          options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
        });
        return { error: error?.message ?? null };
      },
      async signOut() {
        if (!configured) return;
        await getSupabaseBrowser().auth.signOut();
      },
    }),
    [session, loading, configured],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}