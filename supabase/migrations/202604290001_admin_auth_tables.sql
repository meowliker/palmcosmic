-- Admin authentication tables and initial admin user.
-- The app compares password_hash directly so the value can be edited manually in Supabase.

create table if not exists public.admins (
  id text primary key,
  name text,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admins
  add column if not exists name text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.admin_sessions (
  id text primary key,
  admin_id text not null references public.admins(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_sessions_admin_id_idx on public.admin_sessions(admin_id);
create index if not exists admin_sessions_expires_at_idx on public.admin_sessions(expires_at);

alter table public.admins enable row level security;
alter table public.admin_sessions enable row level security;

insert into public.admins (id, name, password_hash, updated_at)
values (
  'Anay',
  'Anay',
  'Kittu@2003',
  now()
)
on conflict (id) do update
set
  name = excluded.name,
  password_hash = excluded.password_hash,
  updated_at = now();
