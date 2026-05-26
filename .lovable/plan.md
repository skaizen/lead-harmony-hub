## Phase 1 plan — Lead Ops Dashboard (TanStack Start + external Supabase + ERPNext)

### Stack decisions (locked)

- **Framework**: TanStack Start (React + Vite + TS) — Lovable's native scaffold, fully previewable here.
- **Styling**: Tailwind CSS.
- **Backend**: TanStack server functions + `src/server/` route handlers for API endpoints.
- **DB + Auth**: **Your external Supabase project** (Lovable Cloud will NOT be enabled). You provide URL + keys; I'll wire them as env vars/secrets.
- **CRM**: ERPNext REST API via typed client.

### Connecting your external Supabase

I'll need three values from you (Supabase Dashboard → Project Settings → API):
- `VITE_SUPABASE_URL` — public, goes in `.env`.
- `VITE_SUPABASE_ANON_KEY` — public, goes in `.env`.
- `SUPABASE_SERVICE_ROLE_KEY` — **secret**, stored via Lovable's secret manager, only used server-side for admin operations and sync jobs.

You'll run the migration SQL against your own project (CLI `supabase db push` or paste into SQL Editor). I'll include both options in the README.

### Phase 1 scope

In: app shell, auth, full schema migration (all 5 tables), Leads list + detail + edit, ERPNext client, push/pull sync, sync log viewer, settings page.
Out (Phase 2): Meta/Google Ads ingestion, WordPress webhook, Analytics page, charts.

### Folder structure

```text
src/
├─ routes/
│  ├─ __root.tsx                       app shell (sidebar + topbar)
│  ├─ index.tsx                        Overview (count cards in Phase 1)
│  ├─ login.tsx                        Supabase email/password login
│  ├─ leads/
│  │  ├─ index.tsx                     unified leads table + filters
│  │  └─ $id.tsx                       lead detail + timeline + sync controls
│  ├─ sync.logs.tsx                    erp_sync_log viewer with drawer
│  └─ settings.tsx                     read-only env var status
├─ server/
│  ├─ leads.ts                         server fns: list/get/update/create
│  ├─ sync.ts                          server fns: pushToErpnext, pullFromErpnext
│  └─ auth.ts                          session helpers
├─ lib/
│  ├─ supabase/browser.ts              browser client (anon key)
│  ├─ supabase/server.ts               server client (service role, server-only)
│  ├─ erpnextClient.ts                 typed REST wrapper
│  ├─ leadSyncService.ts               push/pull orchestration + logging
│  └─ types.ts                         Lead, ErpnextLeadPayload, etc.
├─ components/
│  ├─ AppShell.tsx, Sidebar.tsx, TopBar.tsx
│  ├─ LeadsTable.tsx, LeadFilters.tsx
│  ├─ LeadDetailForm.tsx, LeadTimeline.tsx, LeadSyncPanel.tsx
│  └─ SyncLogTable.tsx, SyncLogDrawer.tsx
supabase/
└─ migrations/0001_init.sql            all 5 tables + RLS + triggers + indexes
.env.example
README.md
```

### Database schema (single migration, all 5 tables)

All five tables per your spec (`leads`, `lead_events`, `erp_sync_log`, `ad_insights_meta`, `ad_insights_google`). Phase 1 only writes to the first three, but the others ship now so Phase 2 needs no schema work. Includes:

- All columns exactly as you specified.
- `updated_at` trigger on `leads`.
- Indexes: `leads(source)`, `leads(status)`, `leads(created_at)`, `leads(erpnext_lead_name)`, `lead_events(lead_id, created_at)`, `erp_sync_log(lead_id, requested_at)`.
- RLS enabled on every table. Phase 1 policy: any authenticated user can read/write (single-tenant). Comments mark where to tighten later.

### Auth

- Supabase email/password.
- A root-level guard in `__root.tsx` redirects unauthenticated users to `/login` (except `/login` itself).
- Server functions verify `supabase.auth.getUser()` (re-validates with Auth server) and return 401 if absent.
- Sign-out clears the session and redirects to `/login`.

### ERPNext client (`lib/erpnextClient.ts`)

- Reads `ERPNEXT_BASE_URL`, `ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET` from server env (Lovable secrets).
- `Authorization: token {key}:{secret}` header.
- Methods: `listLeads({ updated_after, limit, offset })`, `getLead(name)`, `createLead(payload)`, `updateLead(name, partial)`.
- Typed `ErpnextLeadPayload` aligned to ERPNext Lead DocType (`lead_name`, `first_name`, `last_name`, `email_id`, `mobile_no`, `company_name`, `status`, `source`, `notes`).
- `fetch` based; throws typed `ErpnextApiError` with status + body so the sync service can log details.

### Sync service (`lib/leadSyncService.ts`)

`syncLeadToErpnext(leadId, userId?)`:
1. Insert `erp_sync_log` row (PENDING, PUSH, CREATE if no `erpnext_lead_name` else UPDATE).
2. Map Supabase lead → ERPNext payload.
3. Call `createLead` or `updateLead`.
4. On success: update `leads.erpnext_lead_name` + `erpnext_last_synced_at`; update log to SUCCESS with `payload_snapshot` + `completed_at`; insert `lead_events` (`ERP_SYNC`).
5. On failure: update log to FAILED with `error_message`; insert `lead_events` with error payload.

`syncLeadFromErpnext(erpLeadName, userId?)`: mirror flow, upserts into `leads` keyed by `erpnext_lead_name`.

`pullUpdatedSince(date, userId?)`: paginates `listLeads`, calls per-record upsert, returns batch summary.

### UI (Phase 1)

- **App shell**: left sidebar (Overview, Leads, ERP Sync Logs, Settings; Analytics shown as "Coming soon"); top bar with user email + sign out. Neutral utilitarian palette.
- **`/`** Overview: total leads, leads by status, leads created in last 30 days — count cards only (charts in Phase 2).
- **`/leads`**: paginated table, columns Created / Name / Email / Phone / Source / Status / ERP Sync (icon + last synced); filters for source (multi), status, date range via search params. Row actions: View, Sync to ERPNext.
- **`/leads/$id`**: editable form for core fields, read-only Attribution (UTM) and Channel IDs sections, ERPNext linkage block, reverse-chrono timeline from `lead_events`, per-lead `erp_sync_log` list, "Sync to ERPNext" button with toast feedback.
- **`/sync/logs`**: filterable table (status, direction, date range); row click opens a drawer with `payload_snapshot` pretty-printed JSON.
- **`/settings`**: lists expected env vars and whether they're present server-side (values never shown).

### Env / secrets

`.env` (public, in repo as `.env.example`):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Lovable secrets (server-only):
```
SUPABASE_SERVICE_ROLE_KEY
ERPNEXT_BASE_URL
ERPNEXT_API_KEY
ERPNEXT_API_SECRET
```

I'll prompt you for these secrets via the secure form after scaffolding so we don't block on them.

### README contents

- Prereqs (Node 20+, your Supabase project, ERPNext credentials).
- Setup: clone, `npm install`, copy `.env.example` → `.env`, run migration, `npm run dev`.
- How the same code runs in Antigravity (just open the folder; identical commands).
- ERPNext field-mapping notes and where to extend.
- Phase 2 extension points with exact file paths.

### Portability to Antigravity later

If you eventually decide to convert to Next.js in Antigravity, ~80% of this code (schema, `lib/erpnextClient.ts`, `lib/leadSyncService.ts`, `lib/types.ts`, all `components/*`, all server functions' bodies) moves unchanged. Only the route file shells and the server function wrappers need renaming to Next.js conventions.

### Acceptance after build

- `npm run build` succeeds, type-check passes.
- App previews in Lovable: login → leads table loads from your Supabase → can open a lead → can click "Sync to ERPNext" and see a log row created (will fail at the HTTP call until ERPNext creds are provided, but log + error path will be exercised).
- Migration SQL is valid and idempotent.

### What I'll do as soon as you approve

1. Switch to build mode.
2. Scaffold the project structure and all files above.
3. Ask you for the Supabase URL + anon key (paste into chat — they're public) and trigger the secure-secret form for `SUPABASE_SERVICE_ROLE_KEY` and the three ERPNext vars.
4. Verify build + type-check, then hand off.

Approve to proceed.