# korean-dart-mcp

> OpenDART 83개 API → 15개 MCP 도구. 금융감독원 전자공시(DART)를 AI로 검색·조회·분석.

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 뭐하는 놈인가

금융감독원 [OpenDART](https://opendart.fss.or.kr/) 전체 API(공시검색·기업개황·재무제표·지분공시·주요사항·증권신고) 를 Claude/MCP 로 호출할 수 있게 만든 서버.

- **키 1개**로 83개 엔드포인트 접근 (일 20,000건 무료)
- **회사명 자동 해결** — "삼성전자" → `corp_code=00126380` 자동 변환
- **enum 압축** — 정기보고서 28개·주요사항 36개를 `report_type`/`event_type` 파라미터로 단일화
- **XBRL 원본 노출** — 재무제표 원본을 Claude에 바로 업로드해 임의 집계 가능

## 킬러 프롬프트 예시

- "삼성전자 최근 분기 매출/영업이익, 전년동기 대비 변화"
- "최근 7일 자기주식 취득 결정한 상장사 전부 리스트"
- "네이버 임원 보수 5억 이상 명단 최근 5년 시계열"
- "지난 30일 합병·분할·교환 공시 전수 1페이지 요약"

## 설치

```bash
npm install -g korean-dart-mcp
```

## 설정

1. [OpenDART](https://opendart.fss.or.kr/) 가입 → 인증키 신청 (이메일로 즉시 수신)
2. `DART_API_KEY` 환경변수 설정

### Claude Desktop

npm 배포 후:

```json
{
  "mcpServers": {
    "korean-dart": {
      "command": "npx",
      "args": ["-y", "korean-dart-mcp"],
      "env": { "DART_API_KEY": "YOUR_KEY" }
    }
  }
}
```

로컬 빌드 직접 연결 (개발 중):

```json
{
  "mcpServers": {
    "korean-dart": {
      "command": "node",
      "args": ["c:/github_project/korean-dart-mcp/build/index.js"],
      "env": { "DART_API_KEY": "YOUR_KEY" }
    }
  }
}
```

## 도구 목록 (15개)

| # | 도구 | 용도 |
|---|------|------|
| 1 | `resolve_corp_code` | 회사명 → corp_code |
| 2 | `search_disclosures` | 공시 검색 |
| 3 | `get_company` | 기업 개황 |
| 4 | `get_financials` | 단일/다중 주요계정 |
| 5 | `download_document` | 공시 원문 + 첨부파일 |
| 6 | `get_full_financials` | 전체 재무제표 + 주요 지표 |
| 7 | `get_xbrl` | XBRL 원본 + 택사노미 |
| 8 | `get_periodic_report` | 정기보고서 28개 |
| 9 | `get_executive_compensation` | 임원·직원 보수 |
| 10 | `get_shareholders` | 최대주주/소액주주/변동 |
| 11 | `get_major_holdings` | 5%룰 + 임원지분 |
| 12 | `get_corporate_event` | 주요사항보고(36종) |
| 13 | `get_securities_filing` | 증권신고서 |
| 14 | `list_recent_filings` | 최근 공시 프리셋 필터 |
| 15 | `compare_companies` | 다중사 재무·공시 크로스 |

## 개발

```bash
npm install
npm run build
DART_API_KEY=xxx node build/index.js
```

## 라이선스

MIT
