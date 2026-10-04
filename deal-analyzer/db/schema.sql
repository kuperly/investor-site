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

-- §32 Comparable properties. One row per comp; stats are computed by the engine.
create table if not exists deal_comps (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references deals(id) on delete cascade,
  address         text not null,
  sale_price      double precision,
  sale_date       date,
  sqft            integer,
  beds            double precision,
  baths           double precision,
  distance_miles  double precision,
  condition       text,
  renovation      text check (renovation in ('renovated','unrenovated')),  -- null = not classified
  source          text,
  source_url      text,
  notes           text,
  included        boolean not null default true,   -- excluded comps stay on file but are left out of stats
  -- Automation hooks: imported comps carry their provider id so re-imports don't duplicate.
  origin          text not null default 'manual' check (origin in ('manual','import')),
  external_id     text,
  created_by      text not null,
  updated_by      text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists deal_comps_deal_idx on deal_comps (deal_id, sale_date desc);
create unique index if not exists deal_comps_external_uq
  on deal_comps (deal_id, source, external_id) where external_id is not null;

-- Comp-supported ARV weighting (added after initial release; idempotent for existing DBs).
alter table deal_comps add column if not exists sale_status text check (sale_status in ('sold','pending','active'));
alter table deal_comps add column if not exists tier text not null default 'standard'
  check (tier in ('standard','bestFit','superComp'));
alter table deal_comps add column if not exists share_override double precision
  check (share_override is null or (share_override > 0 and share_override <= 1));  -- fraction, Super comps only
