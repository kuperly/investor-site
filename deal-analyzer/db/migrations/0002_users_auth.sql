-- 0002 real users (VF-03 foundation, spec section 22). Replaces the unverified Guy/Ben picker.
-- Passwords are scrypt hashes. session_version is bumped to sign a user out everywhere.

create table users (
  id               uuid primary key default gen_random_uuid(),
  username         text not null unique check (username ~ '^[a-z0-9._-]{2,32}$'),
  display_name     text not null unique check (length(display_name) between 1 and 40),
  role             text not null default 'member' check (role in ('admin','member')),
  password_hash    text not null,
  active           boolean not null default true,
  session_version  integer not null default 1,
  created_by       text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Who changed which account and how (never stores passwords or hashes).
create table user_audit (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references users(id) on delete cascade,
  action      text not null,
  detail      jsonb,
  changed_by  text not null,
  changed_at  timestamptz not null default now()
);

create index user_audit_user_idx on user_audit (user_id, changed_at desc);
