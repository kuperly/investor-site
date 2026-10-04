-- ValeForge Deal Analyzer — PostgreSQL schema (Supabase-compatible).
-- Idempotent: safe to run on every start.

create table if not exists deals (
  id           uuid primary key default gen_random_uuid(),
  -- Denormalised from inputs for dashboard filtering/sorting.
  address      text not null,
  city         text,
  state        text,
  zip          text,
  market       text,
  status       text not null default 'Lead'
               check (status in ('Lead','Analyzing','Investigate','Offer','Due Diligence',
                                 'Under Contract','Closed','Rejected','Archived')),
  -- Every underwriting input (see src/engine/types.ts DealInputs).
  -- Unknown values are stored as JSON null — never as 0.
  inputs       jsonb not null,
  -- §31 notes: general, realtor, contractor, lender, comp, risks, nextSteps
  notes        jsonb not null default '{}'::jsonb,
  created_by   text not null,
  updated_by   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists deals_status_idx  on deals (status);
create index if not exists deals_market_idx  on deals (market);
create index if not exists deals_zip_idx     on deals (zip);
create index if not exists deals_updated_idx on deals (updated_at desc);

-- §33 Audit trail: one row per changed field.
create table if not exists deal_audit (
  id          bigint generated always as identity primary key,
  deal_id     uuid not null references deals(id) on delete cascade,
  field       text not null,
  old_value   jsonb,
  new_value   jsonb,
  changed_by  text not null,
  changed_at  timestamptz not null default now()
);

create index if not exists deal_audit_deal_idx on deal_audit (deal_id, changed_at desc);
