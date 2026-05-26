# Lead Ops Dashboard

Single-tenant lead operations dashboard. Unifies leads from ERPNext, Google Ads, Meta
Lead Ads, and WordPress forms in **your external Supabase project**, with
bi-directional sync to **ERPNext**.

Built with **TanStack Start** (React + Vite + TypeScript) + Tailwind. Designed to be
previewable in Lovable and portable to Antigravity / any local IDE.

## Phase 1 status

- ✅ Auth (Supabase email/password)
- ✅ Full SQL schema (`db/migrations/0001_init.sql`) — 5 tables, RLS, indexes, triggers
- ✅ Leads list, filters, pagination
- ✅ Lead detail + edit + timeline
- ✅ ERPNext REST client + push/pull sync service
- ✅ ERP sync log viewer
- ✅ Settings page (env status, manual pull)
- ⏳ Phase 2: Analytics charts, Meta/Google Ads ingestion, WordPress webhook

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Run the database migration against your Supabase project

Open `db/migrations/0001_init.sql` and either:

- Paste into **Supabase Dashboard → SQL Editor** and run, or
- Run via the Supabase CLI:
  ```bash
  supabase db push --file db/migrations/0001_init.sql
  ```

The migration is idempotent — safe to re-run.

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill the public values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Server-only secrets (do **not** put in `.env`; configure via your hosting provider
or Lovable's secret manager):

| Name | Purpose |
|---|---|
| `EXT_SUPABASE_URL` | Your Supabase project URL (server view) |
| `EXT_SUPABASE_SERVICE_KEY` | Service-role key — server-side admin & sync jobs |
| `ERPNEXT_BASE_URL` | e.g. `https://erp.example.com` |
| `ERPNEXT_API_KEY` | ERPNext API user key |
| `ERPNEXT_API_SECRET` | ERPNext API user secret |

> The `VITE_*` and `SUPABASE_*` prefixes are reserved by Lovable's secret manager,
> so the server-side Supabase secrets use the `EXT_` prefix. When running locally
> or in Antigravity you can use `SUPABASE_SERVICE_ROLE_KEY` directly — the admin
> client accepts both names.

Generate ERPNext credentials: User → API Access → Generate Keys.

### 4. Create your first user

- Open the app at `/login` and click "Sign up" to create your account, or
- Pre-create users in **Supabase Dashboard → Authentication → Users**.

### 5. Run

```bash
bun run dev
```

## File layout

```
src/
├── routes/                # TanStack Start file-based routes
│   ├── __root.tsx
│   ├── index.tsx          # /          Overview
│   ├── login.tsx          # /login
│   ├── leads.index.tsx    # /leads
│   ├── leads.$id.tsx      # /leads/:id
│   ├── sync.logs.tsx      # /sync/logs
│   └── settings.tsx       # /settings
├── server/                # TanStack server functions (Node/Workers)
│   ├── auth.ts
│   ├── leads.ts
│   └── sync.ts
├── lib/
│   ├── supabase/
│   │   ├── browser.ts     # Anon-key client
│   │   └── server.ts      # Service-role client (server-only)
│   ├── erpnextClient.ts   # Typed REST wrapper
│   ├── leadSyncService.ts # Push/pull orchestration + audit
│   ├── auth-context.tsx
│   └── types.ts
└── components/
    ├── AppShell.tsx
    └── Guarded.tsx

db/migrations/0001_init.sql
```

## Database schema

- `leads` — unified lead record (any source).
- `lead_events` — timeline (CREATED, UPDATED, STATUS_CHANGED, ERP_SYNC, NOTE_ADDED, ERROR).
- `erp_sync_log` — every push/pull attempt with status, payload snapshot, error message.
- `ad_insights_meta` — Meta Ads daily performance (Phase 2).
- `ad_insights_google` — Google Ads daily performance (Phase 2).

RLS is enabled on every table. Phase 1 policy: any authenticated user can read/write
everything (single-tenant assumption). Tighten by editing policies in the migration.

## ERPNext field mapping

Supabase `leads` → ERPNext `Lead` DocType:

| Supabase | ERPNext |
|---|---|
| `first_name`, `last_name` | `first_name`, `last_name`, `lead_name` (composed) |
| `email` | `email_id` |
| `phone` | `mobile_no` |
| `company_name` | `company_name` |
| `status` | `status` |
| `notes` | `notes` |
| `utm_source` ?? `source` | `source` |

Extend the mapping in `src/lib/leadSyncService.ts` (`mapLeadToErpnext` / `mapErpnextToLead`).

## Phase 2 extension points

| Feature | Where |
|---|---|
| Meta Lead Ads ingestion | new `src/lib/metaClient.ts` + `src/server/sync.ts` |
| Google Ads ingestion | new `src/lib/googleAdsClient.ts` + `src/server/sync.ts` |
| WordPress webhook | new route under `src/routes/api/hooks/wordpress.ts` |
| Analytics charts | `src/routes/analytics.tsx` (Recharts already installed) |

## Portability to Antigravity / Next.js

The codebase is plain React + TypeScript. To open in Antigravity, just clone and
`bun install`. To later migrate to Next.js, ~80% of the code (schema, ERPNext client,
sync service, types, components) transfers unchanged; only the route file shells and
the `createServerFn` wrappers need renaming to Next.js conventions.