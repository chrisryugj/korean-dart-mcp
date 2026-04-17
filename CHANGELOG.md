# Changelog

## [0.4.0] - 2026-04-18

첨부파일 마크다운화 — kordoc 엔진 통합. DART 뷰어 스크래핑으로 첨부파일 접근.

### Added
- **`get_attachments`** (16번째 도구): 공시 첨부파일(HWP/HWPX/PDF/DOCX/XLSX)을 목록 조회하거나 마크다운으로 추출. 두 모드:
  - `mode="list"` — 첨부 목록만 (파일명·download_url·format 힌트). 빠르고 가벼움.
  - `mode="extract"` — 지정 파일 다운로드 + kordoc.parse() → 마크다운 반환. `filename` 또는 `index` 로 지정. `truncate_at` 으로 상한.
- DART 뷰어 HTML 스크래핑 패턴: `/dsaf001/main.do?rcpNo=...` → `node['dcmNo']` 추출 → `/pdf/download/main.do?rcp_no=&dcm_no=` → 첨부 테이블 파싱.

### 의존성 추가
- **`kordoc` ^2.4.0** — HWP/HWPX/PDF/DOCX/XLSX → 마크다운 통합 엔진 (korean-law-mcp 와 공유)
- **`pdfjs-dist` ^4.10.38** — kordoc 의 PDF 파싱용 peer dep (DART 공시 첨부 중 PDF 가 다수)

### Verified
- 삼성전자 사업보고서(2024.03.12) → PDF 본문 추출 921,998 자 (3.7s, 2.2MB PDF → 마크다운)
- 주요사항(자기주식취득결정 정정), 기타공시(사외이사 신고) 첨부 목록 조회 OK
- 한계: 거래소공시(`pblntf_ty=I` / rcept_no 뒷 3자리가 800 계열) 일부는 뷰어 구조 달라 dcm_no 추출 실패 — 에러 메시지로 가이드

### 설계 노트
- OpenDART 표준 API 에는 첨부파일 직접 엔드포인트가 없음. OpenDartReader 도 동일 뷰어 스크래핑 방식 — 사실상 업계 표준.
- HWP/PDF 원본을 LLM 이 직접 읽을 수 있게 됨 → 원본 공시 본문·증빙자료까지 분석 범위 확장.

## [0.3.0] - 2026-04-18

P2 릴리스 — **15/15 도구 완성**. 3종 킬러 분석 도구로 기존 Python 래퍼 대비 차별화.

### Added (합성 래퍼 4개)
- **`get_shareholders`**: 지배구조 4개 섹션(최대주주·변동·소액주주·주식총수)을 1회 호출로 병렬 수집. `get_periodic_report` 4회 대비 1/4 왕복.
- **`get_executive_compensation`**: 임원 보수 6개 섹션(전체·5억 이상 개인별·상위 5인·미등기·주총 승인·유형별)을 1회 합성.
- **`get_major_holdings`**: DS004 2개 엔드포인트(`majorstock` 5%룰 + `elestock` 임원·주요주주 본인 보유) 합성.
- **`get_corporate_event`**: DS005 **36종 이벤트 enum**. `mode="single"` (단일 조회) / `mode="timeline"` (자본 관련 이벤트 전체 병렬 → 날짜순 통합) 듀얼 모드.

### Added (킬러 분석 도구 3개)
- **`insider_signal`**: 임원·주요주주 거래(`elestock`)를 **매수/매도 클러스터로 집계**. 분기 단위 N명 이상 같은 방향이면 `buy_cluster` / `sell_cluster` 시그널. 워렌 버핏 식 "경영진이 본인 돈으로 매수하는가" 프레임을 데이터로 제공.
  - 검증 사례: 삼성전자 2023-2024 기간 `reports=134, unique_buyers=103 vs sellers=4 → strong_buy_cluster`
- **`disclosure_anomaly`**: 정정공시 비율 + 감사인 교체 + 감사의견 비적정 + 자본 스트레스를 교차해 **0-100 risk score + verdict (clean/watch/warning/red_flag)** 산출. 회계 신뢰도 조기경보.
- **`buffett_quality_snapshot`**: N년치 재무를 `fnlttSinglAcnt` N/3 호출로 수집 → **ROE·영업이익률·부채비율 시계열 + 매출/순이익 CAGR** + 버핏 체크리스트 4종(consistent ROE / low debt / growing revenue / growing earnings) 판정.
  - 검증 사례: 삼성전자 최근 6년 `avg_roe=10.26%, 3/4 통과`

### 차별화 포인트
- 기존 Python 래퍼(OpenDartReader/dart-fss)는 raw 테이블만 반환. 본 버전은 raw 를 **LLM 이 스토리로 해석 가능한 분석 프레임**으로 가공해 제공. "재무 데이터 nomenclature"가 아니라 "애널리스트 프레임" 레벨.

### Fixed
- `insider_signal` 기간 필터 버그: `elestock.rcept_dt` 가 `YYYY-MM-DD` 포맷인데 `YYYYMMDD` 만 받던 문제 → 양쪽 정규화
- `get_corporate_event` timeline 날짜 변환: `YYYY-MM-DD` 입력도 수용

### Verified
- 삼성전자 / LG에너지솔루션 대상 실 DART API 호출로 7개 신규 도구 전수 검증 (`scripts/smoke-p2.mjs`)

### 의존성
- 신규 추가 없음 (기존 `zod` + `fetch` 만 사용)

## [0.2.0] - 2026-04-18

P1 릴리스 — 8/15 도구 완성. enum 압축 핵심 도구 `get_periodic_report` 포함.

### Added
- **`get_full_financials`**: 전체 재무제표(BS/IS/CF/CIS/SCE 수백 행). `fs` 로 연결(CFS)/별도(OFS) 선택.
- **`download_document`**: 공시 원문 XML(DART 전용 마크업) ZIP 해제 → UTF-8 텍스트. 대형 보고서 `truncate_at` 절단 (기본 10만 자).
- **`get_xbrl`**: XBRL 원본 ZIP 을 `~/.korean-dart-mcp/xbrl/{rcept_no}_{reprt_code}/` 로 해제. 파싱 없이 원본 경로 반환 — Claude 가 직접 파일 업로드해 임의 집계하는 패턴 지원.
- **`get_periodic_report`**: 사업보고서 29개 섹션(주주·임직원·보수·감사인·배당·자기주식·채권·자금사용 등)을 `report_type` enum 단일화. OpenDartReader 매핑 기반.
- `iconv-lite` 의존성 추가 (원문 XML 의 EUC-KR 인코딩 대응 예비)

### Fixed
- `DartClient.getZip` 가 DART 에러 응답(JSON/HTML)을 ZIP 으로 받아 파싱 실패하던 문제 — PK 매직 넘버 검사 + JSON 에러 파싱 추가
- `get_xbrl` 엔드포인트 `xbrl.xml` → `fnlttXbrl.xml` 로 수정

### Verified
- 삼성전자 2023 사업보고서 원문 6MB XML 정상 추출, XBRL 8개 파일(.xbrl/.xsd/lab/pre/cal/def) 총 20MB+ 정상 해제
- `get_periodic_report` 로 배당·최대주주·회계감사 섹션 교차 검증 완료

## [0.1.0] - 2026-04-18

초기 릴리스 — P0 MVP. 4개 도구 + corp_code 자동 해결.

### Added
- **corp_code 자동 해결**: 서버 기동 시 OpenDART `corpCode.xml` 전량(≈11.6만 건)을 내려받아 SQLite 에 선적재. 24시간 TTL, `~/.korean-dart-mcp/corp_code.sqlite` 캐시. 회사명·6자리 종목코드·8자리 corp_code 어느 것으로 넘겨도 자동 해석.
- **`resolve_corp_code`**: 회사명 → 후보 리스트 (상장사 / 완전일치 / 짧은 이름 순)
- **`search_disclosures`**: DART 공시 목록. 10개 공시유형 `kind` enum(periodic/major/issuance/holdings/audit/…), 기본 최근 3개월 자동.
- **`get_company`**: 기업 개황 (업종·대표자·설립일·홈페이지 등)
- **`get_financials`**: 단일사 → `fnlttSinglAcnt`, 다중사(≥2) → `fnlttMultiAcnt` 자동 분기. 보고서 종류 `q1/half/q3/annual` enum.

### Architecture
- zod 스키마 → JSON Schema 자동 변환 (`z.toJSONSchema({ io: "input" })`) — `default()` 필드는 required 에서 제외되어 MCP 클라이언트 호환성 향상
- 도구별 파일 분리 (`src/tools/<tool>.ts`), 공용 유틸은 `_helpers.ts` 로
- MCP 서버가 첫 툴 호출 직전까지 `resolver.init()` 프라미스를 대기 — 기동 지연 없이 첫 요청만 ≤5s 초기화 비용

### Security
- `.env.example` 에서 실제 API 키 제거 (placeholder 만 유지), 실제 키는 `.env` 로 이전 (`.gitignore` 이미 포함)

### 미구현 (P1 예정)
- `download_document`, `get_full_financials`, `get_xbrl`, `get_periodic_report`
