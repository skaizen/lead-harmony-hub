import { createServerFn } from "@tanstack/react-start";

export const getSupabasePublicConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const rawUrl =
      process.env.EXT_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const url = rawUrl && !/^https?:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;
    // NOTE: EXT_SUPABASE_ANON_KEY is intentionally not used here — only the public
    // VITE_SUPABASE_ANON_KEY (anon/public, not service role) belongs in the browser client.
    return {
      url,
      anonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
    };
  },
);