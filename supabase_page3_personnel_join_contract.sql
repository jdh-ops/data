-- =============================================================================
-- page3_personnel에 total_rate, rest_rate, join_contract 컬럼 추가
-- join_contract: jsonb, 다른 곳에서 [회사명, 브랜드명, 참여율] 배열들을 묶어 저장
-- 모달에서는 [회사명(브랜드명) : 참여율] 형태 태그로 표시
-- Supabase SQL Editor에서 실행.
-- =============================================================================

ALTER TABLE public.page3_personnel
    ADD COLUMN IF NOT EXISTS total_rate NUMERIC(5, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rest_rate NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS join_contract JSONB;

COMMENT ON COLUMN public.page3_personnel.total_rate IS '누적 참여율';
COMMENT ON COLUMN public.page3_personnel.rest_rate IS '잉여 참여율';
COMMENT ON COLUMN public.page3_personnel.join_contract IS '참여 협약 목록. 예: [[회사명1, 브랜드명1, 참여율1], [회사명2, 브랜드명2, 참여율2]]';
