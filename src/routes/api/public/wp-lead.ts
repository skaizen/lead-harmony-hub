import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { getSupabaseAdmin, serverEnv } from "@/lib/supabase/admin.server";

// Public WordPress webhook. Accepts a JSON lead payload from a WP form plugin.
// Sign requests with HMAC-SHA256 of the raw body using WORDPRESS_WEBHOOK_SECRET,
// hex-encoded, in either header: x-wp-signature OR x-webhook-signature.

const Payload = z.object({
  first_name: z.string().max(255).optional().nullable(),
  last_name: z.string().max(255).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  company_name: z.string().max(255).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  form_id: z.string().max(64).optional().nullable(),
  external_id: z.string().max(255).optional().nullable(),
  utm_source: z.string().max(255).optional().nullable(),
  utm_medium: z.string().max(255).optional().nullable(),
  utm_campaign: z.string().max(255).optional().nullable(),
  utm_term: z.string().max(255).optional().nullable(),
  utm_content: z.string().max(255).optional().nullable(),
});

function verify(signature: string | null, body: string, secret: string): boolean {
  if (!signature) return false;
  const clean = signature.replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(clean, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/wp-lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = serverEnv("WORDPRESS_WEBHOOK_SECRET");
        if (!secret) {
          return new Response("Webhook not configured", { status: 503 });
        }
        const body = await request.text();
        const sig =
          request.headers.get("x-wp-signature") ??
          request.headers.get("x-webhook-signature");
        if (!verify(sig, body, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }
        let json: unknown;
        try { json = JSON.parse(body); } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = Payload.safeParse(json);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 400, headers: { "content-type": "application/json" },
          });
        }
        const p = parsed.data;
        const sb = getSupabaseAdmin();
        const { data: lead, error } = await sb
          .from("leads")
          .insert({
            source: "wordpress",
            external_id: p.external_id ?? null,
            first_name: p.first_name ?? null,
            last_name: p.last_name ?? null,
            email: p.email ?? null,
            phone: p.phone ?? null,
            company_name: p.company_name ?? null,
            notes: p.notes ?? null,
            wordpress_form_id: p.form_id ?? null,
            utm_source: p.utm_source ?? null,
            utm_medium: p.utm_medium ?? null,
            utm_campaign: p.utm_campaign ?? null,
            utm_term: p.utm_term ?? null,
            utm_content: p.utm_content ?? null,
          })
          .select("id")
          .single();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
        await sb.from("lead_events").insert({
          lead_id: lead.id,
          event_type: "CREATED",
          payload: { source: "wordpress_webhook", form_id: p.form_id ?? null },
        });
        return new Response(JSON.stringify({ ok: true, id: lead.id }), {
          status: 201, headers: { "content-type": "application/json" },
        });
      },
    },
  },
});