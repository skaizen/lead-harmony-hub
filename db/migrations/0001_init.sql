-- Lead Ops Dashboard — initial schema
-- Run against YOUR external Supabase project:
--   Option A: paste into Supabase SQL Editor and run
--   Option B: `supabase db push` if you use the Supabase CLI
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- ===== leads ============================================================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  source text not null check (source in ('erpnext','google_ads','meta_ads','wordpress','manual')),
  external_id text,

  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,

  status text not null default 'New' check (status in ('New','Contacted','Qualified','Converted','Lost')),
  owner text,
  notes text,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,

  google_ads_campaign_id text,
  google_ads_ad_group_id text,
  google_ads_ad_id text,

  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,

  wordpress_form_id text,

  erpnext_lead_name text unique,
  erpnext_last_synced_at timestamptz
);

create index if not exists leads_source_idx on public.leads (source);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_erpnext_lead_name_idx on public.leads (erpnext_lead_name);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute procedure public.set_updated_at();

-- ===== lead_events ======================================================
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('CREATED','UPDATED','STATUS_CHANGED','ERP_SYNC','NOTE_ADDED','ERROR')),
  payload jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null
);

create index if not exists lead_events_lead_id_created_at_idx
  on public.lead_events (lead_id, created_at desc);

-- ===== erp_sync_log =====================================================
create table if not exists public.erp_sync_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  direction text not null check (direction in ('PULL','PUSH')),
  operation text not null check (operation in ('CREATE','UPDATE')),
  status text not null default 'PENDING' check (status in ('PENDING','SUCCESS','FAILED')),
  triggered_by_user_id uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  erpnext_lead_name text,
  error_message text,
  payload_snapshot jsonb
);

create index if not exists erp_sync_log_lead_id_requested_at_idx
  on public.erp_sync_log (lead_id, requested_at desc);
create index if not exists erp_sync_log_requested_at_idx
  on public.erp_sync_log (requested_at desc);

-- ===== ad_insights_meta =================================================
create table if not exists public.ad_insights_meta (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  campaign_id text not null,
  adset_id text,
  ad_id text,
  impressions integer not null default 0,
  clicks integer not null default 0,
  spend numeric(14,2) not null default 0,
  leads integer,
  raw jsonb,
  unique (date, campaign_id, adset_id, ad_id)
);

-- ===== ad_insights_google ===============================================
create table if not exists public.ad_insights_google (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  campaign_id text not null,
  ad_group_id text,
  ad_id text,
  impressions integer not null default 0,
  clicks integer not null default 0,
  spend numeric(14,2) not null default 0,
  conversions integer,
  raw jsonb,
  unique (date, campaign_id, ad_group_id, ad_id)
);

-- ===== RLS ==============================================================
-- Phase 1 (single-tenant): any authenticated user can read/write everything.
-- Tighten later by replacing the USING/WITH CHECK predicates.
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.erp_sync_log enable row level security;
alter table public.ad_insights_meta enable row level security;
alter table public.ad_insights_google enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array['leads','lead_events','erp_sync_log','ad_insights_meta','ad_insights_google'])
  loop
    execute format('drop policy if exists %I_authed_all on public.%I', t, t);
    execute format(
      'create policy %I_authed_all on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;