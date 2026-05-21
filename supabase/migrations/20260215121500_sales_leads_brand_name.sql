-- sales_leads에 브랜드명 컬럼 추가 (새 문의 모달 등)
alter table public.sales_leads add column if not exists brand_name text;
