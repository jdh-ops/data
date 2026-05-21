-- 담당자·전화·이메일 복수 입력 (JSON 배열) + 검색용 텍스트
alter table public.sales_leads add column if not exists contact_entries jsonb default '[]'::jsonb;
alter table public.sales_leads add column if not exists contacts_search text;
