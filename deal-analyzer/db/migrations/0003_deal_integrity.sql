-- 0003 deal integrity (spec section 22) and stored analysis snapshots (section 2.5).

-- Optimistic locking: every write must name the version it was based on.
alter table deals add column version integer not null default 1;

-- A copy of each saved analysis, so a later formula change never rewrites history.
-- result holds the summary (score, recommendation, key numbers), full holds analyzeDeal() output.
create table deal_analysis_snapshots (
  id              bigint generated always as identity primary key,
  deal_id         uuid not null references deals(id) on delete cascade,
  deal_version    integer not null,
  engine_version  text not null,
  inputs          jsonb not null,
  comp_arv        double precision,
  result          jsonb not null,
  full_result     jsonb not null,
  created_by      text not null,
  created_at      timestamptz not null default now()
);

create index deal_analysis_snapshots_deal_idx on deal_analysis_snapshots (deal_id, created_at desc);
