# Changelog

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
