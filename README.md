# korean-dart-mcp

> OpenDART 83개 API → 16개 MCP 도구. 금융감독원 전자공시(DART)를 AI로 검색·조회·분석.

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 뭐하는 놈인가

금융감독원 [OpenDART](https://opendart.fss.or.kr/) 전체 API(공시검색·기업개황·재무제표·지분공시·주요사항·증권신고) 를 Claude/MCP 로 호출할 수 있게 만든 서버.

- **키 1개**로 83개 엔드포인트 접근 (일 20,000건 무료)
- **회사명 자동 해결** — "삼성전자" → `corp_code=00126380` 자동 변환
- **enum 압축** — 정기보고서 29개·주요사항 36개를 `report_type`/`event_type` 파라미터로 단일화
- **XBRL 원본 노출** — 재무제표 원본을 Claude에 바로 업로드해 임의 집계 가능
- **애널리스트 프레임 3종** — raw 테이블이 아니라 LLM 이 해석 가능한 시그널/스코어/체크리스트 단위로 가공해 제공
- **첨부파일 마크다운화** — HWP/HWPX/PDF/DOCX/XLSX 공시 첨부를 [kordoc](https://github.com/chrisryugj/kordoc) 엔진으로 변환해 LLM 이 본문을 직접 읽음

## 킬러 프롬프트 예시

기본:
- "삼성전자 최근 분기 매출/영업이익, 전년동기 대비 변화"
- "최근 7일 자기주식 취득 결정한 상장사 전부 리스트"
- "네이버 임원 보수 5억 이상 명단 최근 5년 시계열"
- "지난 30일 합병·분할·교환 공시 전수 1페이지 요약"

애널리스트:
- "삼성전자 임원 거래 최근 2년 매수/매도 클러스터 분석해줘" → `insider_signal`
- "카카오 최근 3년 회계 리스크 스코어 뽑아줘 — 정정공시·감사인 교체·의견 종합" → `disclosure_anomaly`
- "네이버 지난 10년 버핏식 퀄리티 체크리스트 돌려줘" → `buffett_quality_snapshot`
- "LG에너지솔루션 2021년 이후 자본 이벤트 타임라인 전부" → `get_corporate_event(mode=timeline)`

원문 분석:
- "삼성전자 2023 사업보고서 PDF 본문 직접 읽어 리스크 요소 섹션 요약해줘" → `get_attachments(mode=extract)`

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

## 도구 목록 (16개)

### 기본 조회 (8)
| # | 도구 | 용도 |
|---|------|------|
| 1 | `resolve_corp_code` | 회사명 → corp_code |
| 2 | `search_disclosures` | 공시 검색 (10개 `kind` enum) |
| 3 | `get_company` | 기업 개황 |
| 4 | `get_financials` | 단일/다중 주요계정 |
| 5 | `download_document` | 공시 원문 XML |
| 6 | `get_full_financials` | 전체 재무제표 + 지표 |
| 7 | `get_xbrl` | XBRL 원본 + 택사노미 |
| 8 | `get_periodic_report` | 정기보고서 29개 섹션 (`report_type` enum) |

### 합성 래퍼 (4)
| # | 도구 | 용도 |
|---|------|------|
| 9 | `get_shareholders` | 지배구조 4섹션 1회 합성 |
| 10 | `get_executive_compensation` | 임원 보수 6섹션 1회 합성 |
| 11 | `get_major_holdings` | 5%룰(majorstock) + 임원지분(elestock) |
| 12 | `get_corporate_event` | 주요사항 36종 enum + `timeline` 모드 |

### 애널리스트 프레임 (3 · 킬러)
| # | 도구 | 용도 |
|---|------|------|
| 13 | `insider_signal` | 임원 매수/매도 클러스터 · `strong_buy_cluster` 등 시그널 |
| 14 | `disclosure_anomaly` | 회계 리스크 0-100 스코어 (정정·감사인·의견·자본스트레스) |
| 15 | `buffett_quality_snapshot` | N년 ROE·부채비율·CAGR + 버핏 체크리스트 4종 |

### 원문 분석 (1)
| # | 도구 | 용도 |
|---|------|------|
| 16 | `get_attachments` | 공시 첨부 HWP/PDF/DOCX/XLSX → 마크다운 (kordoc 엔진) |

## 개발

```bash
npm install
npm run build
DART_API_KEY=xxx node build/index.js
```

## 라이선스

MIT
