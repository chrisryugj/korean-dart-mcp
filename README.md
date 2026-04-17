# Korean DART MCP

**OpenDART 83개 API를 15개 도구로.** 공시·재무·지분·XBRL + **버핏급 애널리스트 프레임(내부자 시그널·회계 리스크·퀄리티 체크리스트)** + **HWP/PDF 첨부 마크다운화**를 AI 어시스턴트에서 바로 사용.

[![npm version](https://img.shields.io/npm/v/korean-dart-mcp.svg)](https://www.npmjs.com/package/korean-dart-mcp)
[![MCP 1.27](https://img.shields.io/badge/MCP-1.27-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 금융감독원 [OpenDART](https://opendart.fss.or.kr/) 전자공시 기반 MCP 서버 + CLI. Claude Desktop, Cursor, Windsurf, Claude Code 등에서 바로 사용 가능.

자매 프로젝트: [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) (법제처 41 API → 15 도구)

---

## v0.7.0 — LLM 네이티브 분석 레이어

DART 83 API 를 LLM 이 **스토리로 해석 가능한 분석 프레임**으로 가공해서 넘깁니다. 아래는 대표적인 네 가지 사용 시나리오.

### 버핏·그레이엄 관점 정량화

```
"삼성전자 임원 거래 최근 2년 매수/매도 클러스터 분석해줘"
```

→ `insider_signal` 한 번으로:

- 매수 보고 103건 (고유 임원 103명)
- 매도 보고 4건 (고유 임원 4명)
- 시그널: **`strong_buy_cluster`** (매수/매도 비율 25:1)
- 분기별 클러스터: 2024Q1 `buy_cluster` (n=42, net +380만주) → 2024Q2 `buy_cluster` (n=31, net +210만주) ...

버핏 철학의 "경영진이 본인 돈으로 매수하는가?" 를 데이터로 굳혀 LLM 에 넘깁니다.

### N년 퀄리티 체크리스트 + 피어 비교

```
"삼성전자·SK하이닉스·LG전자 5년 퀄리티 비교"
```

→ `buffett_quality_snapshot(corps=[...])`:

| 기업 | 평균 ROE | D/E | 매출 CAGR | 순이익 CAGR | 체크리스트 |
|---|---:|---:|---:|---:|---:|
| SK하이닉스 | 12.86% | 45.95% | 22.6% | 45.37% | **3/4** |
| 삼성전자 | 10.39% | **29.94%** | 4.51% | 3.17% | 1/4 |
| LG전자 | 5.37% | 140.33% | 4.81% | -3.63% | 0/4 |

- ROE 랭킹: **SK하이닉스 > 삼성전자 > LG전자**
- 부채 안정성 랭킹: **삼성전자 > SK하이닉스 > LG전자**
- ROE 일관성 (stddev): LG전자(2.09) > 삼성전자(3.91) > SK하이닉스(18.44)

### 회계·거버넌스 리스크 스코어

```
"카카오 최근 3년 회계 리스크 스코어"
```

→ `disclosure_anomaly`:

- 정정공시 비율, 감사인 교체 이력, 감사의견 비적정, 자본 스트레스 이벤트 빈도를 **0-100 스코어**로 집계
- `verdict: clean / watch / warning / red_flag`
- 각 flag 의 근거(evidence) 구조화

### HWP/PDF 첨부를 LLM이 직접 읽음

```
"삼성전자 2023 사업보고서 본문에서 '위험요소' 섹션 요약해줘"
```

→ `get_attachments(mode=extract)`:

- DART 뷰어 HTML 스크래핑으로 첨부 목록 조회
- [kordoc](https://github.com/chrisryugj/kordoc) 엔진으로 HWP/HWPX/PDF/DOCX/XLSX → 마크다운 변환
- 삼성전자 2.2MB PDF 사업보고서 → **921,998 자 마크다운 (3.7초)**. LLM 이 원문 전체를 컨텍스트로 읽고 분석

DART XML 원문(`download_document(format=markdown)`) 도 자체 파서로 heading/테이블 보존된 마크다운 변환.

---

## 왜 만들었나

한국 상장사 약 3,000개의 공시·재무가 [DART](https://dart.fss.or.kr) 한 곳에 모여 있지만, 개발자가 쓰려면 83개 엔드포인트를 직접 조합해야 합니다. 다행히 한국 개발자 생태계에는 [OpenDartReader](https://github.com/FinanceData/OpenDartReader)(438⭐) 와 [dart-fss](https://github.com/josw123/dart-fss)(364⭐) 라는 훌륭한 Python 래퍼가 있어, **엔드포인트 매핑·XBRL 파싱 노하우가 이미 정리돼 있습니다**. 이 프로젝트도 그 매핑을 상당 부분 그대로 수용했습니다.

이 프로젝트는 두 래퍼가 커버하지 못하는 **다른 레이어**를 목표로 합니다:

- **pandas 생태계용** — OpenDartReader / dart-fss. DataFrame 으로 분석가가 직접 핸들링.
- **LLM 네이티브용** — 이 프로젝트. raw 테이블을 **전문가가 쓰는 각도**(버핏 체크리스트·내부자 시그널·회계 리스크 스코어·공시 타임라인·마크다운 원문)로 한 번 더 정제해, AI 어시스턴트가 바로 스토리를 만들 수 있게 합니다.

둘은 **보완 관계**입니다. DataFrame 이 필요하면 Python 래퍼, AI 에이전트용 프레임이 필요하면 이 MCP.

---

## 설치 및 사용법

### 0단계: API 키 발급 (무료, 1분)

모든 방법에 공통으로 **OpenDART 인증키**가 필요합니다.

1. [OpenDART 가입 페이지](https://opendart.fss.or.kr/uss/umt/cmm/EgovMberInsertView.do) 에서 회원가입
2. 로그인 후 [인증키 신청](https://opendart.fss.or.kr/mng/apiUsageStatusView.do) → 이메일로 **40자 인증키** 즉시 수신
3. 이 인증키를 아래 설정의 `DART_API_KEY` 에 넣습니다. 일 20,000건 무료.

---

### 방법 1: Claude Desktop / Cursor / Windsurf (가장 쉬움)

**사전 준비**: [Node.js 20+](https://nodejs.org) 설치.

설정 파일에 아래 내용을 추가하세요 (`YOUR_API_KEY` 를 본인 키로 교체):

**설정 파일 위치:**

| 앱 | Windows | Mac |
|---|---|---|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Cursor | 프로젝트 `.cursor/mcp.json` | 프로젝트 `.cursor/mcp.json` |
| Windsurf | 프로젝트 `.windsurf/mcp.json` | 프로젝트 `.windsurf/mcp.json` |
| Claude Code | `~/.claude.json` 또는 프로젝트 `.mcp.json` | `~/.claude.json` 또는 프로젝트 `.mcp.json` |

**설정 내용:**

```json
{
  "mcpServers": {
    "korean-dart": {
      "command": "npx",
      "args": ["-y", "korean-dart-mcp"],
      "env": {
        "DART_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

저장 후 앱을 **재시작**하면 15개 DART 도구가 활성화됩니다.

> 이미 다른 MCP 서버를 쓰고 있다면, `"mcpServers": { ... }` 안에 `"korean-dart": { ... }` 부분만 추가하세요.

---

### 방법 2: 내 컴퓨터에 직접 설치

```bash
npm install -g korean-dart-mcp
```

설정 파일에 `command` 를 바꿔 등록:

```json
{
  "mcpServers": {
    "korean-dart": {
      "command": "korean-dart-mcp",
      "env": {
        "DART_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

첫 실행 시 OpenDART 가 제공하는 **전체 기업 덤프(약 11.6만 건)** 를 내려받아 `~/.korean-dart-mcp/corp_code.sqlite` 에 FTS 인덱싱합니다 (약 5초, 24시간 TTL). 이후 회사명 / 종목코드 / corp_code 어느 형식으로 넘겨도 자동 해석됩니다.

---

### API 키 전달 방법

| 방법 | 사용법 | 언제 쓰나 |
|---|---|---|
| 환경변수 | `DART_API_KEY=...` | Claude Desktop 등 설정 파일 |
| `.env` 파일 | 프로젝트 루트 `.env` | 로컬 개발 |

---

## 사용 예시 — 킬러 프롬프트

**기본 조회**
```
"삼성전자 최근 분기 매출·영업이익, 전년 동기 대비 변화"
"최근 30일 자기주식 취득 결정한 상장사 전부"
"네이버 2023년 임원 보수 5억 이상 명단"
```

**애널리스트 프레임**
```
"삼성전자 임원 거래 최근 2년 매수/매도 클러스터 분석"     → insider_signal
"카카오 최근 3년 회계 리스크 스코어 (정정·감사인·의견)"   → disclosure_anomaly
"네이버 10년 버핏식 퀄리티 체크리스트"                    → buffett_quality_snapshot
"삼성·SK하이닉스·LG전자 5년 퀄리티 비교 + 순위"           → buffett_quality_snapshot(corps=[...])
"LG에너지솔루션 2021년 이후 자본 이벤트 타임라인 전부"    → get_corporate_event(mode=timeline)
```

**원문 분석**
```
"삼성전자 2023 사업보고서 PDF 본문에서 '위험요소' 섹션 요약"   → get_attachments(mode=extract)
"삼성전자 자기주식 취득 결정 원본 XML 마크다운으로"           → download_document(format=markdown)
```

**배치 조회**
```
"최근 7일 자기주식 취득 결정 상장사 전부"        → search_disclosures(preset=treasury_buy)
"최근 30일 전환사채·신주인수권부사채 발행 공시"    → search_disclosures(preset=cb_issue, days=30)
```

---

## 도구 구조 (15개)

### 기본 조회 (7)
| 도구 | 용도 |
|---|---|
| `resolve_corp_code` | 회사명 → corp_code (SQLite FTS 선적재, 전수 11.6만 건) |
| `search_disclosures` | 공시 검색. `page` / `preset`(22종 자동필터) / `all_pages` **3모드** + 페이지 병렬화 |
| `get_company` | 기업 개황 (업종·대표자·설립일) |
| `get_financials` | 재무정보. `scope: summary`(주요계정, 단일/다중사) / `full`(전체 BS/IS/CF, 단일사) |
| `download_document` | 공시 원문 → `format: markdown`(DART XML 자체 파서) / `raw` / `text` |
| `get_xbrl` | XBRL 원본 ZIP 해제 경로 반환 — Claude 가 직접 파일 업로드해 임의 집계 |
| `get_periodic_report` | 정기보고서 **29 섹션 enum** (배당·최대주주·감사인·보수·자금사용 등) |

### 합성 래퍼 (4)
| 도구 | 용도 |
|---|---|
| `get_shareholders` | 지배구조 4섹션(최대주주·변동·소액주주·주식총수) 병렬 합성 |
| `get_executive_compensation` | 임원 보수 6섹션(전체·5억 이상·상위 5·미등기·주총승인·유형별) |
| `get_major_holdings` | 5%룰(majorstock) + 임원·주요주주 본인 지분(elestock) |
| `get_corporate_event` | 주요사항보고서 **36 이벤트 enum** + `mode: single` / `timeline` |

### 애널리스트 프레임 (3 · 킬러)
| 도구 | 용도 |
|---|---|
| `insider_signal` | 임원 거래를 매수/매도 **클러스터 시그널**로 집계 (`strong_buy_cluster` 등) |
| `disclosure_anomaly` | 정정공시·감사인 교체·비적정 의견·자본 스트레스 → **0-100 score + verdict** |
| `buffett_quality_snapshot` | N년 ROE/부채/CAGR + **버핏 체크리스트 4종**. corps 배열 지원 (1개=시계열, 2+=비교+랭킹) |

### 원문 분석 (1)
| 도구 | 용도 |
|---|---|
| `get_attachments` | 공시 첨부 HWP/HWPX/PDF/DOCX/XLSX → 마크다운 ([kordoc](https://github.com/chrisryugj/kordoc)) + ZIP 재귀 파싱 |

---

## 주요 특징

- **83 API → 15 도구** — OpenDART 전체(공시·재무·지분·주요사항·정기보고서·XBRL) 를 enum 압축. LLM 컨텍스트 8-10k → 6-8k 토큰
- **회사명 자동 해결** — "삼성전자" / "005930" / "00126380" 어느 형식이든 자동 변환 (SQLite FTS 선적재, 24h TTL)
- **버핏급 애널리스트 프레임** — raw 테이블 위에 **시그널/스코어/체크리스트** 레이어를 얹어 AI 에이전트가 바로 쓰도록 가공
- **HWP/PDF 첨부 마크다운화** — [kordoc](https://github.com/chrisryugj/kordoc) 엔진으로 공시 원문 본문을 LLM 이 직접 읽음 (2.2MB PDF → 3.7초)
- **DART XML 자체 파서** — `dart4.xsd` 전용 마크업을 heading·테이블 보존된 마크다운으로 변환
- **페이지 병렬화** — `search_disclosures` 배치 모드 30-50초 → 17초 (2-3배)
- **22 프리셋** — 자기주식·CB/BW·합병·5%보유·정정·부실·소송 등 자주 쓰는 조합을 enum 으로
- **XBRL 원본 노출** — 파싱 안 하고 해제 경로만 반환. Claude 가 직접 집계 가능
- **OpenDartReader/dart-fss 호환 매핑** — 검증된 Python 래퍼들의 엔드포인트 매핑을 그대로 수용

---

## 참고

- [OpenDART API 목록](https://opendart.fss.or.kr/intro/infoApiList.do) — 공식 83 엔드포인트
- [FinanceData/OpenDartReader](https://github.com/FinanceData/OpenDartReader) — pandas 래퍼 (438⭐)
- [josw123/dart-fss](https://github.com/josw123/dart-fss) — XBRL 파싱 (364⭐)
- 자매 프로젝트 [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) — 법제처 MCP

## Star History

<a href="https://www.star-history.com/?repos=chrisryugj%2Fkorean-dart-mcp&type=timeline&legend=bottom-right">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=chrisryugj/korean-dart-mcp&type=timeline&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=chrisryugj/korean-dart-mcp&type=timeline&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=chrisryugj/korean-dart-mcp&type=timeline&legend=top-left" />
  </picture>
</a>

## 라이선스

[MIT](./LICENSE)

---

<sub>Made by 류주임 @ 광진구청 AI동호회 AI.Do</sub>
