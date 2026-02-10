-- =============================================================================
-- contract_registry RLS 정책 (협약 추가 모달 저장 시 "new row violates row-level security" 방지)
-- Supabase SQL Editor에서 실행하세요.
-- =============================================================================

ALTER TABLE public.contract_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contract_registry_select" ON public.contract_registry;
CREATE POLICY "contract_registry_select" ON public.contract_registry FOR SELECT USING (true);

DROP POLICY IF EXISTS "contract_registry_insert" ON public.contract_registry;
CREATE POLICY "contract_registry_insert" ON public.contract_registry FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "contract_registry_update" ON public.contract_registry;
CREATE POLICY "contract_registry_update" ON public.contract_registry FOR UPDATE USING (true);

DROP POLICY IF EXISTS "contract_registry_delete" ON public.contract_registry;
CREATE POLICY "contract_registry_delete" ON public.contract_registry FOR DELETE USING (true);
