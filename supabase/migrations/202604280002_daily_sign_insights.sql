create table if not exists public.daily_sign_insights (
  id text primary key,
  sign text not null,
  date text not null,
  insights jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_sign_insights_sign_date_idx
  on public.daily_sign_insights (sign, date);

alter table public.daily_sign_insights enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_sign_insights'
      and policyname = 'anon_daily_sign_insights_select'
  ) then
    create policy "anon_daily_sign_insights_select"
      on public.daily_sign_insights
      for select
      using (true);
  end if;
end $$;

