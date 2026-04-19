# Changelog

## [0.9.2] - 2026-04-19

설치 경험 개선. 한 줄 마법사로 macOS / Linux / Windows 모두 대응.

### Added
- **`npx -y korean-dart-mcp setup`** — 대화형 설치 마법사. OpenDART 인증키 입력 → 8개 AI 클라이언트 자동 감지 (Claude Desktop / Claude Code / Cursor / VS Code / Windsurf / Gemini CLI / Zed / Antigravity) → 설정 파일 자동 패치. `[감지됨]` 배지로 실제 설치된 클라이언트 구분.
- **Windows `cmd /c npx` 자동 래핑** — Windows 에선 `command: "cmd"`, `args: ["/c", "npx", ...]` 로 자동 생성. Claude Desktop 이 `.cmd` 확장자를 해석하지 못해 `npx not found` 나던 이슈 원천 차단.
- **README 상단 "30초 설치" 섹션** — 수동 JSON 편집 없이 설치하도록 가장 눈에 띄는 위치에 마법사 소개.

## [0.9.1] - 2026-04-18

프로덕션 publish 직전 보안·품질 하드닝. 기능 변경 없음, API 완전 호환.

### Security
- **ZIP Slip 방어** (`safeUnzipToDisk`): `get_xbrl format=raw` 에서 `out_dir` 밖으로 탈출하는 엔트리 경로(`..`, 절대경로, Windows 드라이브, `\0`) 를 거부. 이전에는 악성 ZIP 이 `../../../authorized_keys` 같은 경로로 임의 파일 쓰기 이론적으로 가능.
- **ZIP Bomb 방어** (`safeUnzipToMemory` / `safeUnzipToDisk`): 모든 yauzl 사용처 5곳을 공용 헬퍼로 통합. 기본 한도 총 200MB · 엔트리당 100MB · 엔트리 5000개. 10KB ZIP 이 수 GB 로 해제되는 OOM 크래시 방지. corp_code 전량 덤프 경로는 300MB 로 상향.
- **HTTPS 강제**: DART 뷰어 HTML 스크래핑(`get_attachments`) 의 origin 을 `http://dart.fss.or.kr` → `https://` 로 교체. MITM 시 악성 첨부 URL 주입 방어.
- **chunks 상한**: `search_disclosures` 자동분할이 `bgn=1900-01-01` 같은 악의·실수 입력에서 수천 chunks 로 폭발하지 않도록 40 chunks(≈10년) 상한.

### Quality
- **재귀 depth 가드** (xbrl-parser `visit()`): 비정상 presentation taxonomy 의 stack overflow 방어 (MAX_DEPTH=100).
- **parseWarnings** (`XbrlData`): DOM 파싱 에러가 누적됐는데 fact 가 0건이면 `parseWarnings` 로 노출. "데이터 없음" vs "파싱 실패" 혼동 해소.

### Internal
- **신규**: `src/utils/safe-zip.ts` — `safeUnzipToMemory` / `safeUnzipToDisk` 공용 헬퍼.
- `get-xbrl.ts`, `get-attachments.ts`, `download-document.ts`, `xbrl-parser.ts`, `corp-code.ts` 의 중복 yauzl 루프를 공용 헬퍼로 리팩터.

## [0.9.0] - 2026-04-18

XBRL 본격 taxonomy 파싱 + search 90일 자동분할 + insider/anomaly 요약문.

### Added
- **`get_xbrl` `format="markdown_full"`**: presentation linkbase(`*_pre.xml`) 기반 **전체 계정 + 계층 구조**, calculation linkbase(`*_cal.xml`) 기반 **합산 검증**. 기존 `markdown` 모드의 whitelist 50태그 대비 BS 50+ / IS 15+ / CF 10+ 모든 공시 계정을 반영. 업종별 택소노미 (금융지주 `DX2xx` / 보험 등) 에 자동 대응.
  - role 코드 자동 분류: `D210xxx`=BS, `D310xxx`=IS, `D410xxx`=CI, `D610xxx`=CF. 접미 `00`=연결/`05`=별도.
  - 계산 검증(`validations`): calculation linkbase 의 `summation-item` 관계로 부모=합산자식 비교. 0.1% 이상 or 5원 이상 차이만 보고.
  - 라벨 depth 마크다운 들여쓰기 (`&nbsp;` × 2 × depth).
- **`search_disclosures` 90일 자동 분할**: `corp_code` 미지정 + 기간 90일 초과 시 90일 청크로 자동 분할 → OpenDART 의 "전체시장 3개월 제약" 우회. 응답에 `chunks` 필드 노출 (단일 청크는 생략).
- **`insider_signal.summary_text`**: 한국어 3~4문장 자동 요약 (보고건수·고유매수자/매도자·순증감·cluster 시그널·최강분기).
- **`disclosure_anomaly.summary_text`**: 한국어 요약 (점수·verdict·정정공시·감사인교체·비적정의견·자본스트레스 핵심지표).
- **scripts/field-test-v0_9.mjs** — 신규 5 시나리오 (XBRL full × 일반/금융, 자동분할, 2개 요약문).

### Fixed
- XBRL role regex: `role-D210000` 은 `D(\d)\d{4}(\d\d)` 로는 매칭 실패 — 6자리 role 코드 기준으로 `D(\d)\d{3}(\d\d)` + `DX?` (금융지주 prefix) 로 교정.

### Verified (45/45 PASS)
- smoke-v0_7_1.mjs: 9/9 (v0.7.1 핫픽스 회귀 없음)
- field-test-v0_8.mjs: 28/28 (15 도구 전체 시나리오)
- test-xbrl-markdown.mjs: 3/3 (whitelist 모드 삼성/LG/SK)
- field-test-v0_9.mjs: 5/5 (full 모드 + 금융지주 + auto-split + summary_text × 2)

## [0.8.0] - 2026-04-18

XBRL 마크다운 변환 + concurrency 옵션화 + 필드테스트 안정화.

### Added
- **`get_xbrl` format=markdown 모드**: instance document 파싱 → BS/IS/CF 3개 표를 **당기·전기·전전기 3열** 로 마크다운 생성. whitelist 기반 약 50 태그 (ifrs-full + K-IFRS dart). 연결/별도 선택. lab-ko.xml primary role 라벨 + `KO_FALLBACK` 내장 매핑. 6MB XBRL → **~8KB 마크다운 (~99% 절감), ~500ms**.
  - 본격 taxonomy/계층/계산관계 파싱은 v0.9.0 에서 추가 예정.
  - format 기본값은 `"raw"` 유지 → 기존 ZIP 해제 플로우 완전 호환.
- **`search_disclosures` concurrency 파라미터** (1–10, 기본 5). 벤치 결과: concurrency=10 에서 **6.73× 빠름** (24.5s → 3.6s), rate limit 에러 없음, 동일 결과.
- **scripts/field-test-v0_8.mjs** — 15 도구 × 28 실전 시나리오 자동 회귀 테스트.
- **scripts/bench-concurrency.mjs** — 1/3/5/7/10 단계별 × 3 trial 측정.
- **scripts/test-xbrl-markdown.mjs** — 삼성·LG·SK 대형 3사 × 연간 XBRL 변환 검증.
- **README-EN.md** — 영문권 독자용 (DART/EDGAR 비유, corp_code/rcept_no 용어 설명).

### Fixed
- **`resolve_corp_code` 숫자 코드 직접 매칭**: 6자리 종목코드(예 `005930`) 또는 8자리 corp_code 를 넘기면 `resolver.byStockCode`/`byCorpCode` 경로로 즉시 매칭. 기존에는 LIKE 검색만 시도해 숫자 코드는 0건 반환.

### Verified
- field-test-v0_8.mjs: **28/28 PASS** (resolver alias / 3종 포맷 download / XBRL / 29 periodic sections / 36 event timeline / insider cluster / anomaly score / buffett 비교 모두 정상)
- XBRL 마크다운: 삼성 자산 455.9조·영업수익 258.9조 / LG 자산 60.2조 / SK 자산 100.3조 (3사 ×  당기·전기·전전기 3열 완결)
- smoke-v0_7_1.mjs 9/9 PASS (기존 핫픽스 회귀 없음)

## [0.7.1] - 2026-04-18

Critical 6건 핫픽스 — 응답 사이즈 폭발 + 파서 에러 방어.

### Fixed
- Resolver alias: "네이버" → NAVER 본체, "현대차" → 현대자동차 본체 (한글 약칭 우선).
- dart-xml errorHandler: 사업보고서 markdown 변환 시 malformed XML 에서 throw 안 함.
- get_financials full sj_div 기본 필터: BS+IS 만 반환 (전체 대비 응답 ~70% 절감).
- get_major_holdings 기간+limit 기본값: 최근 3년, majorstock 50 / elestock 200 limit.
- insider_signal reporters_topn 기본 5: 분기별 reporters 명단 컷.
- get_attachments outline_max_items 기본 50: 사업보고서 outline 수천 행 → 50 행 컷.

## [0.7.0] - 2026-04-18

도구 **18 → 15** 통폐합 + 페이지 병렬화. LLM 컨텍스트 절약과 선택 혼란 감소.

### Merged (3 도구 제거)
- **`get_full_financials` → `get_financials`**: `scope: "summary" | "full"` enum 으로 통합. summary 는 단일/다중사 자동, full 은 단일사 전체 재무제표(fs=consolidated/separate).
- **`quality_compare` → `buffett_quality_snapshot`**: `corps: string[]` (1~10). 1개면 시계열+체크리스트, 2+면 기업별 스냅샷 + 5지표 랭킹. 기업별 병렬 실행.
- **`list_recent_filings` → `search_disclosures`**: `preset` 파라미터로 22 프리셋 흡수. preset 또는 `all_pages: true` 지정 시 배치 모드.

### Performance
- **`search_disclosures` 페이지 병렬화**: 1페이지로 total_page 확인 후 2~N 페이지 `Promise.all` (동시성 5). 기존 `list_recent_filings` 30일 배치 30~50초 → **~17초** (2~3배 개선).
- rate limit 고려해 동시성 5 로 제한 (DART 권고 1,000 req/min 내).

### 설계 노트
- 합성 래퍼(get_shareholders, get_executive_compensation, get_major_holdings) 와 애널리스트 프레임(insider_signal, disclosure_anomaly) 은 **유지**. 파라미터 셋이 너무 달라 enum 분기 시 오히려 혼란.
- `download_document` 와 `get_attachments` 는 접근 경로(표준 API vs 뷰어 스크래핑) 다름 → 유지.

### Verified
- `search_disclosures` 3 모드 (page/preset/all_pages) 전수 통과
- `get_financials` summary(단일/다중)·full(단일 OK, 다중 에러로 가드)
- `buffett_quality_snapshot` corps=1 snapshot / corps=3 compare+rankings 모두 정상
- 총 **15 도구** 실 DART API 검증 완료

## [0.6.0] - 2026-04-18

배치·비교 편의 — 2개 신규 도구 (17, 18번).

### Added
- **`list_recent_filings`** (17번째): 22개 공시 프리셋(자기주식 취득/처분, CB/BW/EB 발행, 유상증자, 합병/분할, 5% 대량보유, 사업/반기/분기보고서, 감사보고서, 정정공시, 부실/소송 등) 으로 최근 N일 공시 빠르게 배치 조회. `search_disclosures` 의 고수준 래퍼 — LLM 이 pblntf_ty + report_nm 키워드 조합을 매번 조립하는 실수 방지.
- **`quality_compare`** (18번째): 기업 2~10개의 N년 퀄리티 지표(ROE·부채비율·매출/순이익 CAGR·버핏 체크리스트 통과 수) 병렬 수집 + 지표별 순위. 내부적으로 `buffett_quality_snapshot` 재활용.

### Verified
- 최근 30일 `treasury_buy` 62건, `cb_issue` 92건, `merger` 17건, `large_holding_5pct` 3000+ 정상 수집·필터
- 삼성전자/SK하이닉스/LG전자 5년 비교: SK하이닉스 ROE 12.86%·순이익 CAGR 45.37%·3/4 통과, 삼성전자 저부채 29.94%·안정, LG전자 D/E 140%·0/4

## [0.5.0] - 2026-04-18

원문 커버리지 확장 — 거래소공시 graceful 처리, DART XML → 마크다운 파서, ZIP 재귀 파싱.

### Added
- **DART XML → 마크다운 파서** (`src/lib/dart-xml.ts`): DART 전용 XML 마크업(`dart4.xsd`)을 자체 파싱해 heading·테이블 보존된 마크다운으로 변환. `@xmldom/xmldom` 기반.
- **`download_document` format 파라미터**: `markdown` (기본) / `raw` / `text`. 기존 raw XML 텍스트만 반환에서 확장 — LLM 이 사업보고서 원문을 헤딩·표 구조로 바로 읽음.
- **`get_attachments` ZIP 재귀 파싱**: ZIP 첨부를 `zip_index` 지정으로 내부 파일 kordoc 파싱. XBRL ZIP 은 `get_xbrl` 로 안내.
- **`get_attachments` 거래소공시 graceful 처리**: `pblntf_ty=I` 일부 공시는 DART 뷰어에 `dcm_no` 내재되지 않음 → `supported: false` + `unsupported_reason` + 대안 도구 제안으로 명확한 실패. throw 없이 LLM 이 바로 폴백 가능.

### Verified
- 삼성전자 자기주식 결정 공시 원본 31k 자 → 마크다운 1.9k 자 (heading·테이블 보존)
- 거래소공시 `20241223800004` → `supported: false, reason: 뷰어에 dcm_no 없음, 대안: download_document`
- XBRL ZIP extract → `get_xbrl` 안내 메시지 반환

### 설계 노트
- DART XML 파서는 완전판이 아님. 주요 태그 (`SECTION-n`, `TITLE`, `TABLE`, `P`, `TABLE-GROUP`, `PGBRK`) 만 대응. 병합 셀(COLSPAN) 은 마크다운 포맷이 지원 안해 무시.
- 거래소공시(pblntf_ty=I 일부) 는 구조적으로 첨부 접근 불가 — OpenDartReader 도 동일 한계.

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
