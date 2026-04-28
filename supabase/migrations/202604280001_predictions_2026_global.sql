create table if not exists public.predictions_2026_global (
  id text primary key,
  zodiac_sign text not null,
  prediction jsonb not null,
  version text not null default '1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.predictions_2026_global enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'predictions_2026_global'
      and policyname = 'anon_predictions_2026_select'
  ) then
    create policy "anon_predictions_2026_select"
      on public.predictions_2026_global
      for select
      using (true);
  end if;
end $$;

