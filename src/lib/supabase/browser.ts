import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config.functions";

let url: string | undefined = import.meta.env.VITE_SUPABASE_URL as string | undefined;
let anonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let client: SupabaseClient | null = null;
let configLoaded = Boolean(url && anonKey);
let loadPromise: Promise<void> | null = null;

export async function loadSupabaseConfig(): Promise<boolean> {
  if (configLoaded) return true;
  if (!loadPromise) {
    loadPromise = getSupabasePublicConfig()
      .then((cfg) => {
        if (cfg?.url && cfg?.anonKey) {
          url = cfg.url;
          anonKey = cfg.anonKey;
          configLoaded = true;
        }
      })
      .catch(() => {});
  }
  await loadPromise;
  return configLoaded;
}

export function getSupabaseBrowser(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("Supabase config not loaded yet. Call loadSupabaseConfig() first.");
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export function hasSupabaseBrowserConfig(): boolean {
  return configLoaded;
}