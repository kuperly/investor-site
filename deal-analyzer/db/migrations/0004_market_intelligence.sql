-- 0004 VF-03 Market Intelligence. Separate tables from the Deal Analyzer, connected only through
-- candidates (hand-off), deal samples (capital efficiency) and deal outcomes (feedback loop).

-- Structured geography (VF-03 section 10). id is the machine key: official codes, never names.
create table geographies (
  id          text primary key check (id ~ '^(country|cbsa|submarket|zcta|tract|bg|micro):[A-Za-z0-9-]+$'),
  level       text not null check (level in ('country','msa','submarket','zcta','tract','block_group','micro')),
  code        text,
  name        text not null,
  parent_id   text references geographies(id),
  state       text,
  metadata    jsonb not null default '{}'::jsonb,
  created_by  text not null,
  created_at  timestamptz not null default now()
);
create index geographies_parent_idx on geographies (parent_id);
create index geographies_level_idx on geographies (level);

-- Every ingestion attempt (section 15), with its raw payloads.
create table ingestion_runs (
  id                   uuid primary key default gen_random_uuid(),
  provider             text not null,
  geo_id               text references geographies(id) on delete cascade,
  status               text not null default 'running' check (status in ('running','succeeded','partial','failed')),
  requested_by         text not null,
  request              jsonb,
  accepted             integer not null default 0,
  rejected             integer not null default 0,
  duplicates           integer not null default 0,
  errors               jsonb not null default '[]'::jsonb,
  methodology_version  text not null,
  started_at           timestamptz not null default now(),
  finished_at          timestamptz
);
create index ingestion_runs_geo_idx on ingestion_runs (geo_id, started_at desc);

create table ingestion_raw (
  run_id   uuid not null references ingestion_runs(id) on delete cascade,
  seq      integer not null,
  payload  jsonb not null,
  primary key (run_id, seq)
);

-- Observations: append-only (never overwritten). Rejected values are kept with their reasons.
create table market_observations (
  id                   uuid primary key default gen_random_uuid(),
  geo_id               text not null references geographies(id) on delete cascade,
  metric               text not null,
  value                double precision,
  unit                 text not null,
  moe                  double precision,
  detail               jsonb,
  source               text not null,
  source_url           text,
  as_of                date,
  retrieved_at         timestamptz not null,
  confidence           text not null check (confidence in ('official_primary','verified_local_commercial','multiple_secondary','single_secondary','anecdotal')),
  methodology          text not null,
  methodology_version  text not null,
  validation_status    text not null check (validation_status in ('accepted','rejected')),
  validation_errors    jsonb not null default '[]'::jsonb,
  raw                  jsonb,
  run_id               uuid references ingestion_runs(id) on delete set null,
  entered_by           text not null,
  fingerprint          text not null,
  created_at           timestamptz not null default now(),
  -- An accepted value always has a number and a date. A rejected one may not (never stored as 0).
  check (validation_status = 'rejected' or (value is not null and as_of is not null))
);
create unique index market_observations_fingerprint_uq on market_observations (fingerprint);
create index market_observations_geo_idx on market_observations (geo_id, metric, as_of desc);

create or replace function vf_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'market_observations is append-only: add a new observation instead';
end
$$;
create trigger market_observations_append_only before update on market_observations
  for each row execute function vf_append_only();

-- Hard risk flags (section 8). Critical blocks advancement regardless of score.
create table market_hard_flags (
  id           uuid primary key default gen_random_uuid(),
  geo_id       text not null references geographies(id) on delete cascade,
  severity     text not null check (severity in ('critical','high')),
  category     text not null,
  reason       text not null,
  source       text not null,
  source_url   text,
  active       boolean not null default true,
  created_by   text not null,
  created_at   timestamptz not null default now(),
  resolved_by  text,
  resolved_at  timestamptz
);
create index market_hard_flags_geo_idx on market_hard_flags (geo_id) where active;

-- Capital-efficiency samples underwritten by the Deal Analyzer engine (section 6).
create table market_deal_samples (
  id          uuid primary key default gen_random_uuid(),
  geo_id      text not null references geographies(id) on delete cascade,
  label       text not null,
  kind        text not null check (kind in ('assumption','deal')),
  deal_id     uuid references deals(id) on delete set null,
  inputs      jsonb,
  source      text not null,
  source_url  text,
  confidence  text not null,
  as_of       date not null,
  active      boolean not null default true,
  created_by  text not null,
  created_at  timestamptz not null default now(),
  check ((kind = 'deal' and deal_id is not null) or (kind = 'assumption' and inputs is not null))
);
create index market_deal_samples_geo_idx on market_deal_samples (geo_id) where active;

-- Admin overrides of configurable thresholds, with history (section 12/13: configurable + auditable).
create table market_config (
  key         text primary key,
  value       jsonb not null,
  updated_by  text not null,
  updated_at  timestamptz not null default now()
);

-- Market Intelligence snapshots (section 16). One row per geography per evaluation run.
create table market_snapshots (
  id               bigint generated always as identity primary key,
  batch_id         uuid not null,
  geo_id           text not null references geographies(id) on delete cascade,
  peer_group       text not null,
  evaluation_date  date not null,
  engine_version   text not null,
  config           jsonb not null,
  priority         double precision,
  decision         text not null check (decision in ('KEEP','WATCH','DROP','DRILL_DOWN')),
  result           jsonb not null,
  created_by       text not null,
  created_at       timestamptz not null default now()
);
create index market_snapshots_geo_idx on market_snapshots (geo_id, created_at desc);
create index market_snapshots_batch_idx on market_snapshots (batch_id);

-- Conditional drill-down (section 17): a promotion stores why.
create table geo_promotions (
  id           uuid primary key default gen_random_uuid(),
  geo_id       text not null references geographies(id) on delete cascade,
  snapshot_id  bigint references market_snapshots(id) on delete set null,
  reason       jsonb not null,
  promoted_by  text not null,
  promoted_at  timestamptz not null default now(),
  revoked_by   text,
  revoked_at   timestamptz
);
create unique index geo_promotions_active_uq on geo_promotions (geo_id) where revoked_at is null;

-- Avatars (section 11). Defined by Guy/Ben, none built in.
create table avatars (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text not null default '',
  criteria    jsonb not null,
  strategies  jsonb not null default '[]'::jsonb,
  active      boolean not null default true,
  version     integer not null default 1,
  created_by  text not null,
  updated_by  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Candidates (section 18): a specific property that deserves underwriting.
create table candidates (
  id             uuid primary key default gen_random_uuid(),
  geo_id         text not null references geographies(id),
  avatar_id      uuid references avatars(id) on delete set null,
  address        text not null,
  city           text,
  state          text,
  zip            text,
  property_type  text,
  beds           double precision,
  baths          double precision,
  sqft           double precision,
  year_built     integer,
  asking_price   double precision,
  condition      text,
  est_arv        double precision,
  est_rehab      double precision,
  est_rent       double precision,
  source         text not null,
  source_url     text,
  notes          text,
  status         text not null default 'new' check (status in ('new','handed_off','rejected')),
  deal_id        uuid references deals(id) on delete set null,
  version        integer not null default 1,
  created_by     text not null,
  updated_by     text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index candidates_geo_idx on candidates (geo_id, status);

-- The deal remembers which candidate it came from.
alter table deals add column source_candidate_id uuid references candidates(id) on delete set null;

-- One audit table for every VF-03 change: geographies, observations entered by hand, flags,
-- samples, avatars, candidates, promotions, configuration.
create table market_audit (
  id          bigint generated always as identity primary key,
  entity      text not null,
  entity_id   text not null,
  action      text not null,
  old_value   jsonb,
  new_value   jsonb,
  changed_by  text not null,
  changed_at  timestamptz not null default now()
);
create index market_audit_entity_idx on market_audit (entity, entity_id, changed_at desc);

-- Feedback loop (section 20): actual results next to what was predicted.
create table deal_outcomes (
  deal_id                   uuid primary key references deals(id) on delete cascade,
  candidate_id              uuid references candidates(id) on delete set null,
  geo_id                    text references geographies(id) on delete set null,
  avatar_id                 uuid references avatars(id) on delete set null,
  predicted_snapshot_id     bigint references deal_analysis_snapshots(id) on delete set null,
  property_type             text,
  purchase_price            double precision,
  arv                       double precision,
  rehab                     double precision,
  rent                      double precision,
  timeline_months           double precision,
  exit_strategy             text,
  actual_profit             double precision,
  actual_annual_cash_flow   double precision,
  actual_refi_loan          double precision,
  actual_capital_recovered  double precision,
  notes                     text,
  version                   integer not null default 1,
  recorded_by               text not null,
  recorded_at               timestamptz not null default now()
);
