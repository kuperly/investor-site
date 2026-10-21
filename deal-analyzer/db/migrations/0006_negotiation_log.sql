-- 0006 Negotiation log (Guy/Ben, Oct 15 2026): offers, seller responses, price cuts and outcomes,
-- recorded per lead and/or per deal. Append-only: a correction is a new event with a note.
-- These records are the evidence for any future negotiation-likelihood rule.

create table negotiation_events (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid references candidates(id) on delete cascade,
  deal_id       uuid references deals(id) on delete cascade,
  kind          text not null check (kind in (
                  'our_offer','seller_counter','seller_accepted','seller_rejected','no_response',
                  'price_cut','under_contract','closed','lost')),
  amount        double precision check (amount is null or amount >= 0),
  event_date    date not null,
  note          text,
  created_by    text not null,
  created_at    timestamptz not null default now(),
  check (candidate_id is not null or deal_id is not null)
);
create index negotiation_events_candidate_idx on negotiation_events (candidate_id, event_date);
create index negotiation_events_deal_idx on negotiation_events (deal_id, event_date);

create or replace function vf_negotiation_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'negotiation_events is append-only: record a new event instead';
end
$$;
create trigger negotiation_events_append_only before update on negotiation_events
  for each row execute function vf_negotiation_append_only();
