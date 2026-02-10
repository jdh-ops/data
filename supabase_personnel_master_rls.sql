-- =============================================================================
-- personnel_master RLS 정책 (인력 현황 모달에서 저장 시 "반영 안 됨" 방지)
-- Supabase SQL Editor에서 실행하세요.
-- =============================================================================

ALTER TABLE public.personnel_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personnel_master_select" ON public.personnel_master;
CREATE POLICY "personnel_master_select" ON public.personnel_master FOR SELECT USING (true);

DROP POLICY IF EXISTS "personnel_master_insert" ON public.personnel_master;
CREATE POLICY "personnel_master_insert" ON public.personnel_master FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "personnel_master_update" ON public.personnel_master;
CREATE POLICY "personnel_master_update" ON public.personnel_master FOR UPDATE USING (true);

DROP POLICY IF EXISTS "personnel_master_delete" ON public.personnel_master;
CREATE POLICY "personnel_master_delete" ON public.personnel_master FOR DELETE USING (true);
