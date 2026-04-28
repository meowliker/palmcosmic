create table if not exists public.birth_chart_user_links (
  user_id text not null references public.users(id) on delete cascade,
  birth_chart_id text not null references public.birth_charts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  primary key (user_id, birth_chart_id)
);

create index if not exists birth_chart_user_links_user_idx
  on public.birth_chart_user_links(user_id, updated_at desc);

create index if not exists birth_chart_user_links_chart_idx
  on public.birth_chart_user_links(birth_chart_id, updated_at desc);

alter table public.birth_chart_user_links enable row level security;

drop policy if exists "anon_birth_chart_user_links_select" on public.birth_chart_user_links;
drop policy if exists "anon_birth_chart_user_links_insert" on public.birth_chart_user_links;
drop policy if exists "anon_birth_chart_user_links_update" on public.birth_chart_user_links;
drop policy if exists "anon_birth_chart_user_links_delete" on public.birth_chart_user_links;

create policy "anon_birth_chart_user_links_select"
  on public.birth_chart_user_links for select using (true);

create policy "anon_birth_chart_user_links_insert"
  on public.birth_chart_user_links for insert with check (true);

create policy "anon_birth_chart_user_links_update"
  on public.birth_chart_user_links for update using (true);

create policy "anon_birth_chart_user_links_delete"
  on public.birth_chart_user_links for delete using (true);
