# korean-dart-mcp 프로젝트 가이드

OpenDART(금융감독원 전자공시) 를 MCP 서버로 래핑. `korean-law-mcp`(법제처) 와 자매 프로젝트.

## 구조

```
src/
├── index.ts              # MCP stdio 서버 진입점
├── cli.ts                # CLI 진입점 (korean-dart 명령어)
├── version.ts
├── lib/
│   ├── dart-client.ts    # OpenDART HTTP 클라이언트 (JSON/ZIP)
│   └── corp-code.ts      # corp_code 리졸버 (SQLite FTS)
├── server/
│   └── mcp-server.ts     # MCP Server 팩토리
├── tools/
│   └── index.ts          # 15개 도구 레지스트리
└── utils/
```

## 설계 원칙

### 1. corp_code 자동 해결
- LLM은 "삼성전자"만 알고, 모든 OpenDART API는 `corp_code` 8자리 필수
- 해결: 서버 기동 시 `/api/corpCode.xml` 전체 덤프(≈10만개) SQLite FTS 로 선적재
- 캐시 경로: `~/.korean-dart-mcp/corp_code.sqlite` (없거나 24시간 지나면 재다운)

### 2. enum 으로 도구 폭발 방지
- OpenDART 83개 → MCP 15개
- 정기보고서 28개 → `get_periodic_report({ report_type: "executive_compensation" })`
- 주요사항 36개 → `get_corporate_event({ event_type: "merger" })`
- 참고: korean-law-mcp 에서 41→15 압축한 동일 패턴

### 3. XBRL 원본 노출
- `get_xbrl` 은 파싱하지 않고 원본 XBRL 파일을 그대로 반환
- Claude 가 직접 업로드 받아 임의 집계 → 기존 Python 래퍼(OpenDartReader, dart-fss)가 놓친 LLM 시너지 포인트

## 구현 우선순위

P0 (동작 확인용 MVP):
1. `resolve_corp_code`
2. `search_disclosures`
3. `get_company`
4. `get_financials`

P1 (문서 + XBRL):
5. `download_document`
6. `get_full_financials`
7. `get_xbrl`
8. `get_periodic_report`

P2 (심화):
9-12. 보수/주주/지분/주요사항

P3 (배치·비교):
13-15. 증권신고·최근 공시·비교

## OpenDART 규칙

- Base URL: `https://opendart.fss.or.kr/api/`
- 인증: 모든 요청에 `crtfc_key` 쿼리파라미터
- 응답: JSON (대부분), ZIP (corp_code 덤프·원문·XBRL)
- 요율: 일 20,000건 (키 단위 합산)
- 원문 포맷: DART XML (전용 마크업), HWP/PDF 원본은 `attach_files()` 별도

## 참고

- [OpenDART API 목록](https://opendart.fss.or.kr/intro/infoApiList.do)
- [FinanceData/OpenDartReader](https://github.com/FinanceData/OpenDartReader) — pandas 래퍼 (438⭐)
- [josw123/dart-fss](https://github.com/josw123/dart-fss) — XBRL 파싱 (364⭐)
- 자매 프로젝트: `c:\github_project\korean-law-mcp`
