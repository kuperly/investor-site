-- 0005 Deal Sourcing: the layer between Market Intelligence and the Deal Analyzer.
-- A sourcing target says "search here, for this buy box". Leads (candidates) enter under a
-- target, are screened against its buy box, then handed to the Deal Analyzer.

create table sourcing_targets (
  id               uuid primary key default gen_random_uuid(),
  geo_id           text not null references geographies(id),
  avatar_id        uuid references avatars(id) on delete set null,
  status           text not null default 'active' check (status in ('active','paused','closed')),
  -- Market decision when the target was opened, and the reason when the gate needed one.
  gate_decision    text,
  override_reason  text,
  notes            text,
  version          integer not null default 1,
  created_by       text not null,
  updated_by       text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index sourcing_targets_open_uq on sourcing_targets (geo_id, coalesce(avatar_id::text, '')) where status <> 'closed';

alter table candidates add column target_id uuid references sourcing_targets(id) on delete set null;
-- Normalized address + ZIP, to stop the same property entering twice.
alter table candidates add column address_key text;
alter table candidates add column screening jsonb;
alter table candidates add column screened_at timestamptz;
-- Why a lead that failed screening was still sent to the Deal Analyzer.
alter table candidates add column override_reason text;
create index candidates_target_idx on candidates (target_id, status);
create index candidates_address_key_idx on candidates (address_key);
