import { createServerFn } from "@tanstack/react-start";

export const getSupabasePublicConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    return {
      url: process.env.EXT_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
      anonKey:
        process.env.EXT_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
    };
  },
);