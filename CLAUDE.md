# Wegofair 데이터 (data)

Wegofair 내부 직원이 쓰는 정적 웹 앱이다. 빌드 도구나 프레임워크가 없고, HTML/JS를 GitHub Pages에 그대로 올린다. 새 도구는 이 파일을 먼저 읽고, 비밀 값(키, 비밀번호)은 문서에 다시 적지 않는다.

`.cursorrules` 파일과 `.cursor/rules` 폴더는 없다.

## 1. 프로젝트 개요

회사(`@wegofair.com`) 계정으로 로그인한 뒤, 키워드로 프로젝트(브랜드/업무 단위)에 들어간다. 프로젝트마다 Supabase의 `target_table`(영문 닉네임)로 데이터가 갈린다.

주요 사용자 흐름:

1. `index.html`에서 Google 로그인 (`@wegofair.com`만 허용).
2. 키워드를 입력하면 `gateways` 테이블의 `target_page`로 이동한다. 쿼리는 `?table={영문닉네임}&key={키워드}` 형태다.
3. 연결 페이지는 데이터 관리(`page1`), 보호원·협약(`page3`), 계약 허브(`contract`) 중 하나다.

편의 기능(`convenience.html` / `convenience.js`)은 로그인 게이트와 별도로, 운영 중 반복 작업을 줄이는 도구 모음이다.

## 2. 기술 스택

| 구분 | 사용 |
| --- | --- |
| 언어 | HTML, CSS, 브라우저 JavaScript (번들러 없음) |
| 백엔드 | Supabase (Postgres, Auth, Storage). 클라이언트는 CDN `@supabase/supabase-js@2` |
| 엑셀 | SheetJS `xlsx` 0.20.1 (`https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js`) |
| 정렬 | SortableJS 1.15.0 (`page2.html`) |
| 차트 | Chart.js, `chartjs-plugin-datalabels@2` (`chart.html`) |
| 패키지 관리 | 없음. `package.json`, lockfile, 테스트 러너 없음 |

스크립트는 `<script src>`로 전역에 올린다. `import`/`export` 모듈은 쓰지 않는다. 페이지 간 공유 상태는 `window`에 둔다 (`window._supabase`, `window.tableName`, `window.projectKeyName`).

## 3. 폴더 구조

루트에 페이지와 스크립트가 평평하게 있다. `src/` 같은 앱 디렉터리는 없다.

| 경로 | 역할 |
| --- | --- |
| `index.html` | 로그인·키워드 게이트. Google OAuth 리다이렉트 URL이 여기 있다 |
| `gateway-logic.js` | 키워드 조회, 새 키워드(게이트웨이) 생성 |
| `config.js` | Supabase URL/anon 키, 클라이언트 생성, `@wegofair.com` 접근 검사 |
| `page1.html` | 정품 이미지 저장, 업로드, 설정. 데이터 표는 `page2.html`로 이동 |
| `page2.html` | 프로젝트 데이터 표(행/열 프리셋). `page_manager.js`, `lib_data.js` |
| `page3.html`, `page3.js` | 보호원·협약: 인력, 급여, 참여율, 계약, KPI, 월말 보고. `page3.js`는 매우 큼 |
| `convenience.html`, `convenience.js` | 편의 기능 UI와 로직. `page3.html`에서도 `convenience.js`를 로드한다 |
| `contract-page.html`, `contract-inquiry.js` | 계약 허브(문의 `sales_leads`, 계약, 관리) |
| `chart.html`, `page_chart.js` | 피벗/차트 리포트 프리셋 |
| `keyword-logic.js` | 키워드 관련 보조 로직 |
| `auth-image-logic.js`, `upload-logic.js` | 이미지 인증·업로드 |
| `style.css` | 공통 스타일. 많은 화면은 HTML 인라인 스타일을 함께 쓴다 |
| `lib_data.js` | `data_config` 프리셋 조회 |
| `supabase/migrations/` | 수동 적용용 SQL. CLI가 자동 적용하지 않는다고 가정한다 |
| `supabase-storage-policy.sql` | Storage 정책 참고 SQL |

편의 기능 카드는 `convenience.js`의 `CONVENIENCE_FEATURES` 배열이 단일 소스다.

- `excelMerge`: 엑셀 합치기, 키 열 기준 중복 제거
- `urlConverter`: 지원 사이트 URL 단축
- `workStatus`: 작업 ON/OFF와 이력
- `laborChecker`: 단순 반복 체크
- `urlOpener`: URL을 n개씩 새 탭으로 열기 (Chrome 전용으로 안내됨)

## 4. 실행 방법

설치·빌드 명령은 없다.

1. 저장소를 연다.
2. 정적 서버로 연다. VS Code / Cursor Live Server(Go Live)를 기준으로 한다. `index.html`의 OAuth 분기가 `localhost`와 `127.0.0.1`만 로컬로 본다.
3. `file://`로 열면 Supabase·리다이렉트·상대 스크립트가 깨질 수 있다. `page3.html`은 `file:`일 때만 스크립트 base를 따로 계산한다.
4. Google 로그인이 되려면 Supabase Auth의 Redirect URL에 로컬 origin의 `/index.html`과 운영 URL이 등록되어 있어야 한다.

## 5. 배포

Vercel, Netlify가 아니다. **GitHub Pages**다.

- 저장소: `jdh-ops/data`, 브랜치 `main`
- 운영 URL: `https://jdh-ops.github.io/data/`
- 로그인 완료 후 복귀 주소(비로컬): `https://jdh-ops.github.io/data/index.html` (`index.html`에 하드코딩)

`main`에 push하면 Pages가 정적 파일을 그대로 서빙한다. 빌드 스텝을 추가하면 이 배포 방식과 어긋난다.

DB 스키마는 코드 push와 별개다. `supabase/migrations/`의 SQL을 Supabase SQL Editor(또는 이미 쓰는 CLI)에서 **직접** 실행해야 반영된다.

## 6. 환경 변수

`.env`는 쓰지 않는다. 설정은 `config.js` 상수다. 문서·채팅·커밋 메시지에 실제 키를 붙이지 않는다.

| 이름 | 용도 |
| --- | --- |
| `SUPABASE_URL` | 프로젝트 URL. `config.js` |
| `SUPABASE_KEY` | **anon public** 키만. `service_role` 키를 넣지 않는다. 클라이언트에 실리므로 RLS가 실제 권한 경계다 |
| `system_settings.key = admin_password` | 새 게이트웨이 생성용 관리자 비밀번호. DB 값이며 코드에 적혀 있지 않다. 값을 문서에 복사하지 않는다 |

`window.tableName`은 URL `table` 파라미터(없으면 `default`). `window.projectKeyName`은 URL `key`(표시용 키워드).

## 7. 코딩 규칙

- UI 문구는 한국어.
- 새 프레임워크, 번들러, npm 의존성을 이 레포에 들이지 않는다. 필요하면 기존처럼 CDN 스크립트와 전역 함수로 맞춘다.
- 기존 파일의 문체를 유지한다. `convenience.js`, `page3.js`는 `var`와 `function` 선언이 많고, `gateway-logic.js`는 `const`/`async`를 쓴다. 고칠 파일 안에서 섞지 말고 그 파일 스타일을 따른다.
- 공용 클라이언트는 `window._supabase`(또는 페이지 지역 `_supabase = window._supabase`)만 쓴다. 클라이언트를 페이지마다 새로 만들지 않는다.
- 프로젝트 데이터 조회에는 `target_table` 또는 `project_key`로 현재 `table` 값을 걸어야 한다. 필터 없이 전체 테이블을 읽지 않는다.
- HTML은 컴포넌트 파일이 없다. 마크업과 인라인 스타일을 해당 `*.html`에 두고, 동작은 대응 `*.js`에 둔다.
- 편의 기능 카드를 추가·삭제할 때는 `CONVENIENCE_FEATURES`와 클릭 핸들러(`bindConvenienceCardClick`)를 함께 수정한다. 플레이스홀더 카드(`제목3` 등)는 넣지 않는다.
- URL 단축 사이트를 추가하면 세 곳을 같이 고친다: `convertUrlBySite`, `runUrlConverter`의 카운트/메시지, `convenience.html`의 지원 사이트 목록.
- 사용자가 커밋을 명시하기 전에는 커밋·푸시하지 않는다. 커밋 메시지는 기존 로그처럼 왜 바꿨는지가 보이게 쓴다.
- 사용자 대면 설명과 이 문서의 유지보수 메모는 한국어로 쓴다.

## 8. 정해 둔 결정

### URL 단축

Cafe24형 쇼핑몰은 상품 슬러그 URL을 아래처럼 줄인다.

`https://{host}/product/{슬러그}/{상품번호}/category/.../`  
→ `https://{host}/product/detail.html?product_no={상품번호}`

이 패턴인 사이트: 숲몰, 리쥬더마(pdrnmall), 플리츠미, 메라블, 오하나, 솜솜(somsoc), 순성(soonsungmall), 마리떼(`marithe-official.com`), 애즈온(`ason.kr`). 마크곤잘레스도 `product_no` 쿼리로 줄인다.

그 외:

- **Shopee**: `-i.{shop}.{item}`만 남겨 `/Vanish-i...`
- **Lazada**: `-i{id}`만 남겨 `/products/Vanish-i{id}.html`
- **Taobao**: `https://item.taobao.com/item.htm?id={id}`만 남긴다. 단 `mi_id` 또는 `pisk`가 있으면 `id` 뒤에 그 파라미터까지 유지한다. 상품 추적이 그 값에 의존해서, 다른 쿼리는 버리고 이 둘은 버린다.
- **Temu**: 경로의 `/kr/`(있으면)까지 유지하고 `g-{숫자}.html`만 붙인다.
- **코스알엑스**: 쿼리스트링을 제거하고 pathname만 남긴다.
- **아뜰리에 슈** (`atelierchoux.com`): 컬렉션 경로를 제거한다.  
  `/ko-kr/collections/.../products/{handle}` → `/ko-kr/products/{handle}`  
  언어 접두사(`ko-kr` 같은 `xx` 또는 `xx-xx`)는 유지한다.

### 작업 상태 확인

- 한 작업에 진행 중(`off_at is null`) 세션은 **하나만** 허용한다. DB 유니크 부분 인덱스 `work_status_sessions_one_open_idx`가 막는다. 이미 켜져 있으면 강제 OFF 경고 후에만 넘긴다.
- 로그인 없이 닉네임으로 쓸 수 있게 `anon` RLS를 열어 두었다 (`20260908153000_work_status_anon.sql`). 이력 보기와 삭제는 로그인한 사용자에게만 UI를 보여 준다.
- 이력은 최신 50건만 보여 길이를 제한한다.

### 기타

- 게이트웨이 생성 시 키워드 `계약`이면 기본 연결 페이지는 계약 허브다.
- 보호원 월말 보고 엑셀의 `신고결과` 열은 `data_rows.col16_val`(P열)에 매핑한다.

## 9. 진행·남은 일·알려진 이슈

별도의 이슈 트래커나 TODO 주석 목록은 없다. 기능 추가는 지금까지 편의 기능 카드와 URL 단축 사이트를 하나씩 더하는 방식이었다.

알고 두면 좋은 한계:

- 자동 테스트가 없다. UI 변경은 정적 서버에서 해당 페이지를 직접 확인한다.
- `page3.js`는 4천 줄이 넘는다. 무관한 리팩터를 같이 하지 않는다.
- SQL 마이그레이션 파일이 저장소에 있어도, 원격 DB에 실행되지 않았으면 앱 기능이 실패한다. 작업 상태·`sales_leads`가 대표적이다.
- `work_status_*`의 anon 정책은 `using (true)`라 키만 알면 읽고 쓸 수 있다. 정책을 임의로 좁히면 비로그인 닉네임 사용이 깨진다.
- URL 단축은 호스트와 경로 규칙만 본다. 사이트 HTML이 바뀌어도 단축 결과는 규칙 그대로다. 새 호스트는 예시를 주석에 남긴다.

## 10. 주의할 점

- `config.js`의 anon 키를 다른 파일이나 문서에 복사하지 않는다. `service_role` 키는 절대 프론트에 넣지 않는다.
- `index.html`의 GitHub Pages 리다이렉트 URL을 로컬 주소로 덮어쓰지 않는다. 로컬은 `localhost`/`127.0.0.1` 분기만 탄다.
- `checkWegoFairUser`는 `index.html`이 아닐 때 비로그인·비회사 도메인을 로그인 페이지로 보낸다. 이 가드를 편의 기능 일부(비로그인 작업 상태)와 헷갈려 페이지 전역에서 빼지 않는다.
- `data_rows` 컬럼 이름(`col16_val` 등)은 엑셀 열 위치와 연결되어 있다. 이름만 보고 의미를 바꾸지 않는다.
- 편의 기능 즐겨찾기는 `localStorage` 키 `page3_convenience_favorites`다. 카드 id를 바꾸면 기존 즐겨찾기가 빈 카드가 된다.
- 작업 상태의 “동시 ON 금지”는 앱 if문만이 아니라 DB 유니크 인덱스가 보장한다. 인덱스 없이 앱 로직만 지우면 다시 동시에 켜진다.
- 인라인 스타일이 화면 레이아웃의 대부분이다. 공통 `style.css`만 고치고 끝이 아닌 경우가 많다.
