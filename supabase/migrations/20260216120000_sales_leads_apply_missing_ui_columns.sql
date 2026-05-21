-- 문의 탭 저장 시 "Could not find the 'brand_name' column" 등 오류가 나면
-- Supabase 대시보드 → SQL Editor에서 이 파일 전체를 실행하세요.
-- 실행 후 수십 초~1분 정도 지나면 API 스키마 캐시가 갱신될 수 있습니다.

alter table public.sales_leads add column if not exists brand_name text;
alter table public.sales_leads add column if not exists contact_entries jsonb default '[]'::jsonb;
alter table public.sales_leads add column if not exists contacts_search text;
