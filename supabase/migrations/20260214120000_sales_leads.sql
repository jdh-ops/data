-- 예비 고객 문의 ~ 계약 전 단계 추적 (contract-page 문의 탭)
-- Supabase SQL Editor 또는 CLI로 적용하세요.

begin;

create table if not exists public.sales_leads (
  id bigint generated always as identity primary key,
  target_table text not null,
  company_name text not null default '',
  brand_name text,
  contact_entries jsonb default '[]'::jsonb,
  contacts_search text,
  contact_name text,
  phone text,
  email text,
  channel text,
  interest_notes text,
  stage text not null default '문의접수',
  owner_email text,
  next_action_at timestamptz,
  next_action_note text,
  lost_reason text,
  linked_contract_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_lead_activities (
  id bigint generated always as identity primary key,
  lead_id bigint not null references public.sales_leads (id) on delete cascade,
  activity_type text not null default 'other',
  summary text,
  body text,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists sales_leads_target_table_idx on public.sales_leads (target_table);
create index if not exists sales_leads_target_stage_idx on public.sales_leads (target_table, stage);
create index if not exists sales_leads_updated_idx on public.sales_leads (target_table, updated_at desc);
create index if not exists sales_lead_activities_lead_created_idx on public.sales_lead_activities (lead_id, created_at desc);

alter table public.sales_leads enable row level security;
alter table public.sales_lead_activities enable row level security;

drop policy if exists "sales_leads_select_authenticated" on public.sales_leads;
drop policy if exists "sales_leads_insert_authenticated" on public.sales_leads;
drop policy if exists "sales_leads_update_authenticated" on public.sales_leads;
drop policy if exists "sales_leads_delete_authenticated" on public.sales_leads;

create policy "sales_leads_select_authenticated"
  on public.sales_leads for select to authenticated using (true);

create policy "sales_leads_insert_authenticated"
  on public.sales_leads for insert to authenticated with check (true);

create policy "sales_leads_update_authenticated"
  on public.sales_leads for update to authenticated using (true) with check (true);

create policy "sales_leads_delete_authenticated"
  on public.sales_leads for delete to authenticated using (true);

drop policy if exists "sales_lead_activities_select_authenticated" on public.sales_lead_activities;
drop policy if exists "sales_lead_activities_insert_authenticated" on public.sales_lead_activities;
drop policy if exists "sales_lead_activities_update_authenticated" on public.sales_lead_activities;
drop policy if exists "sales_lead_activities_delete_authenticated" on public.sales_lead_activities;

create policy "sales_lead_activities_select_authenticated"
  on public.sales_lead_activities for select to authenticated using (true);

create policy "sales_lead_activities_insert_authenticated"
  on public.sales_lead_activities for insert to authenticated with check (true);

create policy "sales_lead_activities_update_authenticated"
  on public.sales_lead_activities for update to authenticated using (true) with check (true);

create policy "sales_lead_activities_delete_authenticated"
  on public.sales_lead_activities for delete to authenticated using (true);

commit;
