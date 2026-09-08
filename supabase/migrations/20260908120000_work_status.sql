-- 편의 기능: 작업 상태 확인 (누가 특정 작업을 하고 있는지 ON/OFF 세트 기록)
-- Supabase SQL Editor 또는 CLI로 적용하세요.

begin;

create table if not exists public.work_status_tasks (
  id bigint generated always as identity primary key,
  title text not null,
  is_on boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.work_status_sessions (
  id bigint generated always as identity primary key,
  task_id bigint not null references public.work_status_tasks (id) on delete cascade,
  on_actor text not null default '',
  on_at timestamptz not null default now(),
  off_actor text,
  off_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists work_status_sessions_task_on_idx
  on public.work_status_sessions (task_id, on_at desc);

create index if not exists work_status_sessions_open_idx
  on public.work_status_sessions (task_id)
  where off_at is null;

create unique index if not exists work_status_sessions_one_open_idx
  on public.work_status_sessions (task_id)
  where off_at is null;

alter table public.work_status_tasks enable row level security;
alter table public.work_status_sessions enable row level security;

drop policy if exists "work_status_tasks_select_authenticated" on public.work_status_tasks;
drop policy if exists "work_status_tasks_insert_authenticated" on public.work_status_tasks;
drop policy if exists "work_status_tasks_update_authenticated" on public.work_status_tasks;
drop policy if exists "work_status_tasks_delete_authenticated" on public.work_status_tasks;

create policy "work_status_tasks_select_authenticated"
  on public.work_status_tasks for select to authenticated using (true);

create policy "work_status_tasks_insert_authenticated"
  on public.work_status_tasks for insert to authenticated with check (true);

create policy "work_status_tasks_update_authenticated"
  on public.work_status_tasks for update to authenticated using (true) with check (true);

create policy "work_status_tasks_delete_authenticated"
  on public.work_status_tasks for delete to authenticated using (true);

drop policy if exists "work_status_tasks_select_anon" on public.work_status_tasks;
drop policy if exists "work_status_tasks_insert_anon" on public.work_status_tasks;
drop policy if exists "work_status_tasks_update_anon" on public.work_status_tasks;
drop policy if exists "work_status_tasks_delete_anon" on public.work_status_tasks;

create policy "work_status_tasks_select_anon"
  on public.work_status_tasks for select to anon using (true);

create policy "work_status_tasks_insert_anon"
  on public.work_status_tasks for insert to anon with check (true);

create policy "work_status_tasks_update_anon"
  on public.work_status_tasks for update to anon using (true) with check (true);

create policy "work_status_tasks_delete_anon"
  on public.work_status_tasks for delete to anon using (true);

drop policy if exists "work_status_sessions_select_authenticated" on public.work_status_sessions;
drop policy if exists "work_status_sessions_insert_authenticated" on public.work_status_sessions;
drop policy if exists "work_status_sessions_update_authenticated" on public.work_status_sessions;
drop policy if exists "work_status_sessions_delete_authenticated" on public.work_status_sessions;

create policy "work_status_sessions_select_authenticated"
  on public.work_status_sessions for select to authenticated using (true);

create policy "work_status_sessions_insert_authenticated"
  on public.work_status_sessions for insert to authenticated with check (true);

create policy "work_status_sessions_update_authenticated"
  on public.work_status_sessions for update to authenticated using (true) with check (true);

create policy "work_status_sessions_delete_authenticated"
  on public.work_status_sessions for delete to authenticated using (true);

drop policy if exists "work_status_sessions_select_anon" on public.work_status_sessions;
drop policy if exists "work_status_sessions_insert_anon" on public.work_status_sessions;
drop policy if exists "work_status_sessions_update_anon" on public.work_status_sessions;
drop policy if exists "work_status_sessions_delete_anon" on public.work_status_sessions;

create policy "work_status_sessions_select_anon"
  on public.work_status_sessions for select to anon using (true);

create policy "work_status_sessions_insert_anon"
  on public.work_status_sessions for insert to anon with check (true);

create policy "work_status_sessions_update_anon"
  on public.work_status_sessions for update to anon using (true) with check (true);

create policy "work_status_sessions_delete_anon"
  on public.work_status_sessions for delete to anon using (true);

insert into public.work_status_tasks (title, sort_order)
select v.title, v.sort_order
from (values ('작업1', 0), ('작업2', 1)) as v(title, sort_order)
where not exists (select 1 from public.work_status_tasks);

commit;
