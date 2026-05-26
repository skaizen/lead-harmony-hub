import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client. Uses the SERVICE ROLE key — never import this from a
// browser-bound module. Server functions / route handlers only.

function readEnv(name: string): string | undefined {
  // Cloudflare Workers (nodejs_compat) exposes secrets via process.env; locally Vite does too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = (globalThis as any).process;
  return proc?.env?.[name];
}

export function getSupabaseAdmin(): SupabaseClient {
  const url =
    readEnv("EXT_SUPABASE_URL") ??
    readEnv("VITE_SUPABASE_URL") ??
    readEnv("SUPABASE_URL");
  const serviceKey =
    readEnv("EXT_SUPABASE_SERVICE_KEY") ??
    readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error(
      "Missing EXT_SUPABASE_URL or EXT_SUPABASE_SERVICE_KEY env var on the server.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function serverEnv(name: string): string | undefined {
  return readEnv(name);
}