-- 작업 상태 확인: 비로그인(anon)도 닉네임으로 읽고 쓸 수 있게 합니다.
-- 이미 work_status 테이블을 만든 뒤, Supabase SQL Editor에서 이 파일만 실행하세요.

begin;

grant select, insert, update, delete on table public.work_status_tasks to anon;
grant select, insert, update, delete on table public.work_status_sessions to anon;

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

commit;
