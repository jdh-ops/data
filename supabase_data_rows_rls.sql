-- =============================================================================
-- data_rows RLS 정책 (데이터 관리 페이지에서 행 조회/추가/수정/삭제 허용)
-- Supabase 대시보드 → SQL Editor에서 이 스크립트 전체 실행하세요.
-- =============================================================================
-- 로그인한 사용자(auth.uid() 있음)만 data_rows 접근 가능.
-- 로그인 없이 허용하려면 아래 USING / WITH CHECK 를 (true) 로 바꾸세요.
-- =============================================================================

ALTER TABLE public.data_rows ENABLE ROW LEVEL SECURITY;

-- SELECT: 로그인한 사용자만 조회
DROP POLICY IF EXISTS "data_rows_select" ON public.data_rows;
CREATE POLICY "data_rows_select" ON public.data_rows
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: 로그인한 사용자만 추가
DROP POLICY IF EXISTS "data_rows_insert" ON public.data_rows;
CREATE POLICY "data_rows_insert" ON public.data_rows
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 로그인한 사용자만 수정
DROP POLICY IF EXISTS "data_rows_update" ON public.data_rows;
CREATE POLICY "data_rows_update" ON public.data_rows
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- DELETE: 로그인한 사용자만 삭제
DROP POLICY IF EXISTS "data_rows_delete" ON public.data_rows;
CREATE POLICY "data_rows_delete" ON public.data_rows
  FOR DELETE USING (auth.uid() IS NOT NULL);
