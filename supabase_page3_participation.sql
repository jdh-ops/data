-- =============================================================================
-- page3_participation: 인력별·협약별 참여율 (personnel_id, contract_id, rate)
-- 이 테이블이 없으면 page3 현황/인력 목록 조회 시 404 발생.
-- Supabase SQL Editor에서 실행하세요.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.page3_participation (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    personnel_id BIGINT NOT NULL,
    contract_id BIGINT NOT NULL,
    rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.page3_participation IS '인력-협약별 참여율 (personnel_master.id, contract_registry.id)';
COMMENT ON COLUMN public.page3_participation.personnel_id IS 'personnel_master.id';
COMMENT ON COLUMN public.page3_participation.contract_id IS 'contract_registry.id';
COMMENT ON COLUMN public.page3_participation.rate IS '참여율 (%)';

-- RLS: anon 키로 조회/삽입/수정/삭제 가능하도록 (필요 시 조건 추가)
ALTER TABLE public.page3_participation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page3_participation_select" ON public.page3_participation;
CREATE POLICY "page3_participation_select" ON public.page3_participation FOR SELECT USING (true);

DROP POLICY IF EXISTS "page3_participation_insert" ON public.page3_participation;
CREATE POLICY "page3_participation_insert" ON public.page3_participation FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "page3_participation_update" ON public.page3_participation;
CREATE POLICY "page3_participation_update" ON public.page3_participation FOR UPDATE USING (true);

DROP POLICY IF EXISTS "page3_participation_delete" ON public.page3_participation;
CREATE POLICY "page3_participation_delete" ON public.page3_participation FOR DELETE USING (true);
