import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAdmin } from "@/lib/supabase/admin.server";

// Verifies a Supabase access token (passed from the client) and returns the user id.
// Server functions that mutate data should call this first.
export async function requireUser(accessToken: string | null): Promise<{ id: string; email: string | null }> {
  if (!accessToken) throw new Error("Unauthorized");
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Unauthorized");
  return { id: data.user.id, email: data.user.email ?? null };
}

export const whoAmI = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string | null }) => d)
  .handler(async ({ data }) => {
    return await requireUser(data.accessToken);
  });