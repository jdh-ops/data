-- 작업당 진행 중(ON) 세션은 하나만 허용해 동시 ON을 막습니다.
-- 이미 work_status 테이블이 있으면 Supabase SQL Editor에서 이 파일만 실행하세요.

begin;

delete from public.work_status_sessions a
using public.work_status_sessions b
where a.off_at is null
  and b.off_at is null
  and a.task_id = b.task_id
  and a.id < b.id;

create unique index if not exists work_status_sessions_one_open_idx
  on public.work_status_sessions (task_id)
  where off_at is null;

commit;
