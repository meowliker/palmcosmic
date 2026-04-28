create table if not exists public.promo_codes (
  code text primary key,
  discount_percent integer,
  kind text not null default 'three_day',
  max_uses integer,
  current_uses integer default 0,
  used_count integer not null default 0,
  active boolean default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

alter table public.promo_codes
  add column if not exists kind text not null default 'three_day',
  add column if not exists used_count integer not null default 0,
  add column if not exists last_used_at timestamptz;

update public.promo_codes
set used_count = greatest(coalesce(used_count, 0), coalesce(current_uses, 0))
where current_uses is not null;

alter table public.promo_codes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'promo_codes'
      and policyname = 'anon_promo_codes_select'
  ) then
    create policy "anon_promo_codes_select"
      on public.promo_codes
      for select
      using (true);
  end if;
end $$;
