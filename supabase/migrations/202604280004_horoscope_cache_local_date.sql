create table if not exists public.horoscope_cache (
  id text primary key,
  sign text not null,
  date text not null,
  data jsonb,
  horoscope jsonb,
  period text,
  cache_key text,
  fetched_at timestamptz,
  created_at timestamptz default now()
);

alter table public.horoscope_cache
  add column if not exists data jsonb,
  add column if not exists horoscope jsonb,
  add column if not exists period text,
  add column if not exists cache_key text,
  add column if not exists fetched_at timestamptz;

create index if not exists idx_horoscope_sign_date
  on public.horoscope_cache (sign, date);

create index if not exists horoscope_cache_sign_period_date_idx
  on public.horoscope_cache (sign, period, date);

alter table public.horoscope_cache enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'horoscope_cache'
      and policyname = 'anon_horoscope_cache_select'
  ) then
    create policy "anon_horoscope_cache_select"
      on public.horoscope_cache
      for select
      using (true);
  end if;
end $$;
