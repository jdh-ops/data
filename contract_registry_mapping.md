# contract_registry 테이블 구조 및 모달 매핑

## DB 컬럼 (contract_registry)

| 컬럼명 | 타입 | 기본값 | 비고 |
|--------|------|--------|------|
| id | int8 | - | PK |
| target_table | text | - | 프로젝트 키 (page3의 tableName) |
| company_name | text | - | 기업명 |
| brand_name | text | - | 브랜드명 |
| start_date | date | - | 시작일 |
| end_date | date | - | 종료일 |
| status | text | - | 상태 |
| years | text | - | 3년미만/3년차/5년차/7년 이상 |
| num_tag | text | - | 차수 태그 (예: 1차) |
| total_budget | int8 | 0 | 총 예산/총액 |
| gov_contribution | int8 | 0 | 정부지원금 |
| corp_cash | int8 | 0 | 기업부담 현금 |
| corp_kind | int8 | 0 | 기업부담 현물 |
| total_cash | int8 | 0 | 현금 총계 |
| cash_ratio | numeric | 0 | 현금 비율 |
| kind_ratio | numeric | 0 | 현물 비율 |
| vat | int8 | 0 | 부가세 |
| sum_p | int8 | 0 | 과제비 |
| participation_rate | jsonb | - | 참여 인력: [{ name, rate, period }, ...] |
| corp_size | text | - | 기업 규모 (소기업/중기업/중견기업/대기업) |

---

## 협약 추가 모달 → contract_registry 매핑

| 모달 필드 (id) | contract_registry 컬럼 | 비고 |
|----------------|------------------------|------|
| addContractCompanyType | corp_size | 소기업/중기업/중견기업/대기업 |
| addContractCompanyName | company_name | 기업명 |
| addContractBrandName | brand_name | 브랜드명 |
| addContractYears | years | 3년미만/3년차/5년차/7년 이상 |
| addContractNumTag | num_tag | 제목 옆 입력 (예: 1차) |
| addContractGeneralAdmin | (없음) | 일반관리비 – DB 저장 안 함 |
| addContractTotalCost | total_cash 또는 별도 | 총원가 |
| addContractVat | vat | 부가세 |
| addContractProjectExpense | sum_p | 과제비 |
| addContractCompanyInKind (첫 행) | (없음) | *인건비 6% 이하 문구 옆 – DB 컬럼 없음 |
| addContractCompanyInKind (기업부담 현물 행) | corp_kind | 기업부담 현물 |
| addContractTotalAmount | total_budget | 총액 |
| addContractGovSupport | gov_contribution | 정부지원금 |
| addContractCompanyCash | corp_cash | 기업부담 현금 |
| addContractSubtotal | (저장 안 함) | 인건비 소계 – DB에 넣지 않음 |
| 인력 테이블 (이름/참여율/기간) | participation_rate | jsonb: [{ name, rate, period }, ...] |

---

## page3 협약 관련 테이블

- **contract_registry**: 협약 목록·상세 전부 사용 (target_table, company_name, num_tag, status, participation_rate 등)
- **page3_participation**: 인력별·협약별 참여율 (personnel_id, contract_id = contract_registry.id, rate)

컬럼명: `company_name`, `gov_contribution`, `participation_rate` (전문).
