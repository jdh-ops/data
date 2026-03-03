-- ============================================================
-- 정품 이미지 저장 시 "new row violates row-level security policy" 해결
-- Supabase 대시보드 → SQL Editor에서 이 스크립트 실행
-- ============================================================
-- Storage 버킷 'excel-files'에 파일 업로드(INSERT)를 허용하는 정책 추가

-- 1) 익명(anon) 사용자도 업로드 허용 (로그인 없이 사용하는 경우)
CREATE POLICY "Allow upload to excel-files"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'excel-files');

-- 2) (선택) 읽기 허용 - 이미지 URL로 접근할 때 필요할 수 있음
CREATE POLICY "Allow public read excel-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'excel-files');

-- 이미 정책이 있어서 오류가 나면, 대시보드에서 기존 정책을 확인한 뒤
-- Storage → excel-files → Policies 에서 INSERT 허용 정책을 수동으로 추가하세요.
