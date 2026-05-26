import { createServerFn } from "@tanstack/react-start";

export const getSupabasePublicConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const rawUrl =
      process.env.EXT_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const url = rawUrl && !/^https?:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;
    return {
      url,
      anonKey:
        process.env.EXT_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
    };
  },
);