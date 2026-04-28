[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/chrisryugj-korean-dart-mcp-badge.png)](https://mseep.ai/app/chrisryugj-korean-dart-mcp)

# Korean DART MCP

**OpenDART 83개 API를 15개 도구로.** 공시·재무·지분·XBRL + **버핏급 애널리스트 프레임(내부자 시그널·회계 리스크·퀄리티 체크리스트)** + **HWP/PDF 첨부 마크다운화**를 AI 어시스턴트에서 바로 사용.

[![npm version](https://img.shields.io/npm/v/korean-dart-mcp.svg)](https://www.npmjs.com/package/korean-dart-mcp)
[![MCP 1.27](https://img.shields.io/badge/MCP-1.27-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 금융감독원 [OpenDART](https://opendart.fss.or.kr/) 전자공시 기반 MCP 서버 + CLI. Claude Desktop, Cursor, Windsurf, Claude Code 등에서 바로 사용 가능.

자매 프로젝트: [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) (법제처 41 API → 15 도구)

English documentation → [README-EN.md](README-EN.md)

---

## ⚡ 30초 설치 — 한 줄로 끝

**macOS / Linux / Windows 공용**. Node.js 20.19+ 만 깔려있으면 됩니다.

```bash
npx -y korean-dart-mcp setup
```

대화형 마법사가 띄웁니다:
1. OpenDART 인증키 입력 (없으면 Enter — 나중에 설정 가능, [여기서 무료 발급](https://opendart.fss.or.kr/))
2. 사용 중인 AI 클라이언트 번호 선택 (Claude Desktop / Cursor / Claude Code / Windsurf / VS Code / Gemini CLI / Zed / Antigravity — 설치된 건 `[감지됨]` 표시)
3. 설정 파일 자동 패치 → 클라이언트 재시작

Windows 도 자동으로 `cmd /c npx` 래핑해줘서 `npx not found` 이슈 해결됨. 수동 JSON 편집 불필요.

> 수동 설정을 원하면 아래 [설치 및 사용법](#설치-및-사용법) 섹션 참고.

---

## v0.9 — 무엇이 새로운가

- **`get_xbrl format="markdown_full"`** — presentation/calculation linkbase 를 파싱해 **전체 계정 + 계층 구조 + 합산 검증**. 기존 `markdown` 의 whitelist 50태그 대비 BS 50+ / IS 15+ / CF 10+ 전부 커버. 금융지주 `DX` prefix 등 업종별 택소노미 자동 대응. 6MB XBRL → ~30-60KB 마크다운.
- **`search_disclosures` 90일 자동분할** — `corp_code` 미지정 + 기간 90일 초과 시 자동으로 90일 청크 분할 (OpenDART "전체시장 3개월 제약" 우회). 최대 40 chunks(≈10년).
- **`insider_signal` / `disclosure_anomaly` `summary_text`** — 한국어 자동 요약문 필드 추가. LLM 이 원시 테이블 뽑기 전 한 줄로 맥락 파악.
- **보안 하드닝** (v0.9.1) — ZIP slip / ZIP bomb 방어 공용 헬퍼, HTTPS 뷰어 스크래핑, chunks 상한, presentation 재귀 depth 가드, XBRL 파싱 경고 노출.

---

## 💡 주식에 관심 많은 일반인이 쓸 수 있는 5가지

증권사 앱만으론 아쉬운 **개미 투자자 기준** 킬러 유스케이스. Claude 에게 프롬프트로 그냥 말하면 됨.

### 1. 내 보유종목 "경영진 눈치게임"

```
"삼성전자 최근 1년 임원·대주주 매수/매도 보고 어때?"
```

→ `insider_signal` 이 매수 vs 매도 **클러스터 시그널**로 집계. 실측: 매수 2,429 vs 매도 43 → `strong_buy_cluster` (경영진이 자기 돈으로 사고 있음).
HTS 에선 공시 하나하나 뒤져야 알 수 있는 것을 한 줄 프롬프트로.

### 2. "이 회사 회계 뭐 수상한 거 없나"

```
"카카오 최근 3년 회계 리스크 점수 뽑아줘"
```

→ `disclosure_anomaly` 로 **0-100 스코어 + verdict**(clean/watch/warning/red_flag). 실측: 카카오 40점 `warning` — 정정공시 32.8% 가 임계 초과. 개인이 수동으로 확인 불가능한 리스크 플래그를 자동 탐지.

### 3. "사업보고서 300쪽 읽기 싫어"

```
"삼성전자 2023 사업보고서에서 '위험요소'·'주요 사업' 섹션 요약"
```

→ `get_attachments(mode="extract")` 가 PDF 2.2MB → 마크다운 92만 자로 변환 (3.7초). Claude 가 섹션별로 직접 검색·요약. **증권사 리포트 없이도 원본 읽기 가능**.

### 4. "오늘 이런 공시 낸 회사 누구?"

```
"최근 30일 자기주식 취득 결정한 상장사 전부"
"최근 일주일 유상증자·CB 발행 공시 회사"
"최근 30일 합병·분할 결정 공시"
```

→ `search_disclosures(preset=...)` 22개 프리셋. 자기주식 취득 = 주가 부양 시그널 / 유상증자·CB = 희석 경계. 실측: 최근 30일 자기주식 취득 **59건**. HTS 에서 놓치는 배치 정보를 한 번에.

### 5. "A랑 B 중 뭐가 더 튼튼해"

```
"삼성전자 · SK하이닉스 · LG전자 5년 ROE·부채·성장성 비교"
```

→ `buffett_quality_snapshot(corps=[...])` 이 5지표 자동 랭킹. 실측 (위 [실전 시나리오 1](#1-버핏식-5년-퀄리티-비교--자동-랭킹) 표 참고): SK하이닉스 3/4 체크 통과, 부채 안정성은 삼성 압도적. **종목 고를 때 감각 의존 대신 수치 근거**.

---

### 이런 사람에게 딱

- 본인 **보유 종목 5-20개** 있고 분기·반기마다 공시 점검하는 **중급 개미**
- 뉴스 해석 말고 **원본 공시** 직접 보고 싶은 사람 (기자 편향 싫어하는 타입)
- 네이버 금융·HTS 정보 부족해서 답답한 사람
- 증권사 리포트 안 사고 **직접 기업 분석**하고 싶은 사람

### 이런 사람한텐 오버스펙

- **차트 보고 들어가는 단타** — 이 도구엔 차트·실시간 주가 없음
- **코스피 ETF 만 사는 장투** — 개별 종목 분석 필요 없음
- **Excel·Python 으로 DataFrame 돌리는 퀀트** — OpenDartReader·dart-fss 가 나음 (pandas 네이티브)

### 솔직한 진입 장벽

- Claude Desktop / Cursor 설치 + OpenDART 키 발급 (**10분**, 무료, 일 20,000건)
- ROE · CAGR · 부채비율 용어는 알아야 결과 이해 가능
- Claude Pro 구독 $20/월 (대용량 PDF 요약엔 컨텍스트 넉넉한 상위 플랜이 편함)
- 이 도구는 **리서치 보조용**. 투자 판단은 본인이.

---

## 실전 시나리오 — 실제 API 호출 결과

아래 결과는 실제 DART API 를 때려 얻은 **실측값**. 전부 `scripts/showcase-v0_9_1.mjs` 로 재현 가능 (12/12 PASS).

### 1. 버핏식 5년 퀄리티 비교 + 자동 랭킹

**프롬프트**: *"삼성전자·SK하이닉스·LG전자 최근 5년 퀄리티 지표 비교해줘"*

→ `buffett_quality_snapshot(corps=["삼성전자","SK하이닉스","LG전자"], years=5)`

| 기업 | 평균 ROE | 최근 D/E | 매출 CAGR | 순이익 CAGR | 체크리스트 |
|---|---:|---:|---:|---:|---:|
| 삼성전자 | 10.39% | **29.94%** | 4.51% | 3.17% | 1/4 |
| SK하이닉스 | **12.86%** | 45.95% | **22.6%** | **45.37%** | **3/4** |
| LG전자 | 5.37% | 140.33% | 4.81% | -3.63% | 0/4 |

**자동 생성 랭킹** (5지표별):
- ROE: SK하이닉스(12.86) > 삼성전자(10.39) > LG전자(5.37)
- 부채 안정성: 삼성전자(29.94) > SK하이닉스(45.95) > LG전자(140.33)
- 순이익 CAGR: SK하이닉스(45.37) > 삼성전자(3.17) > LG전자(-3.63)
- ROE 일관성 (stddev ↓): LG전자(2.09) > 삼성전자(3.91) > SK하이닉스(18.44)

### 2. 경영진이 본인 돈으로 매수하고 있는가 (insider_signal)

**프롬프트**: *"삼성전자 최근 1년 내부자 거래 매수/매도 클러스터"*

→ `insider_signal(corp="삼성전자", start="2025-04-18", end="2026-04-18")`

```
삼성전자: 2,473건 보고 (매수 2,429 / 매도 43).
고유 매수자 1,047명 vs 매도자 40명, 순매수 +2,302,375주.
→ strong_buy_cluster 시그널.
최강 클러스터: 2026Q1 (매수 985명/매도 18명).
```

버핏 철학의 *"경영진이 본인 돈으로 매수하는가"* 를 한 호출로 정량화. 최근 24:1 매수 우세.

### 3. 회계·거버넌스 리스크 스코어 (disclosure_anomaly)

**프롬프트**: *"카카오 최근 3년 회계 리스크"*

→ `disclosure_anomaly(corp="카카오")`

```
카카오 (2023-04~2026-04): ⚠️ 경고, 점수 40/100
- 정정공시 167/509건 (32.8%)  ← 임계(20%) 초과로 +30점
- 자본 스트레스 공시 5건       ← +10점
- verdict: warning
```

정정공시·감사인 교체·비적정 의견·자본 스트레스 4개 축을 0-100 스코어로 집계 + 개별 flag 의 evidence 구조화. LLM 은 스토리만 만들면 됨.

### 4. XBRL 전체 계정 + 계산 검증 (v0.9 markdown_full)

**프롬프트**: *"삼성전자 2023 사업보고서 재무제표 전체 계정 뽑아줘"*

→ `get_xbrl(rcept_no="20240312000736", format="markdown_full")`

```
기간: 당기 2023-12-31 / 전기 2022-12-31 / 전전기 2021-12-31
계정 수: BS 52행 · IS 18행 · CF 12행 (whitelist 모드의 17/13/7행 대비 3배)
마크다운 크기: 8,905자 (원본 XBRL 6MB → 99.85% 절감)
계산 검증: ✅ 모두 일치 (0 건 위반)
taxonomy roles: presentation 10개 · calculation 8개
소요: 615ms
```

**계산 검증 자동화**가 핵심 — calculation linkbase 의 `summation-item` 관계로 "부모=자식 합산"을 검증해서 공시 오기재를 즉시 탐지.

### 5. 업종별 택소노미 자동 대응 (금융지주)

**프롬프트**: *"신한지주 최신 사업보고서 재무제표 전체"*

→ 내부적으로 `search_disclosures` 로 rcept_no 찾고 → `get_xbrl(format="markdown_full")`

```
신한지주 2025 사업보고서 (rcept_no=20260318000826)
BS 44행 · IS 49행
계산 검증 위반: 3건 (금융업 특유 항목)
→ DX prefix (금융지주 전용) taxonomy 를 코드 변경 없이 자동 처리
```

dart-fss 도 XBRL ZIP 은 받지만 **금융업 DX prefix 택소노미 자동 대응은 문서에 명시되어있지 않음**. 업종별 커버리지는 이 MCP 의 강점.

### 6. 최근 30일 자기주식 취득 결정 상장사 전수

**프롬프트**: *"최근 30일 자기주식 취득 결정한 상장사 전부"*

→ `search_disclosures(preset="treasury_buy", days=30, limit=500)`

```
매칭 공시 59건 / 8페이지 병렬 수집 (17.5초)

최신 5건:
  2026-04-17 티플랙스 — 자기주식취득신탁계약해지결정
  2026-04-17 엠투엔 — 자기주식취득결정
  2026-04-17 PS일렉트로닉스 — 자기주식취득신탁계약해지결정
  2026-04-15 아세아 — 자기주식취득신탁계약해지결정
  2026-04-15 아세아시멘트 — 자기주식취득신탁계약해지결정
```

22개 프리셋이 `pblntf_ty` + `report_nm` 정규식을 자동 조립. LLM 이 DART 코드를 외울 필요 없음.

### 7. 전체시장 180일 공시 (90일 자동분할, v0.9)

**프롬프트**: *"최근 6개월 사업보고서 낸 회사 전부"*

→ `search_disclosures(preset="annual_report", days=180)`

```
자동분할: 3 chunks (DART '전체시장 3개월' 제약 자동 우회)
총 수집 6,000건 → 사업보고서 매칭 2,625건 (10.3초)

최신 3건:
  2026-01-09 미라셀 사업보고서 (2024.12)
  2026-01-08 케이원제15호판교위탁관리부동산투자회사 사업보고서 (2025.10)
  2026-01-08 삼성FN리츠 사업보고서 (2025.10)
```

### 8. 자본 이벤트 타임라인 (카카오 3년)

**프롬프트**: *"카카오 최근 3년 자본 이벤트 전부"*

→ `get_corporate_event(corp="카카오", mode="timeline", start="2023-04-18", end="2026-04-18")`

| 이벤트 유형 | 건수 |
|---|---:|
| 자기주식 처분 | 14 |
| 감자 | 3 |
| 합병 | 2 |
| CB 발행 | 1 |
| EB 발행 | 1 |
| **합계** | **21** |

36개 이벤트 enum 을 한 번에 병렬 수집 → 날짜순 통합. LLM 이 "카카오가 최근 뭘 했는지" 즉시 파악.

### 9. 지분공시 통합 (5%룰 + 임원 지분)

**프롬프트**: *"삼성전자 최근 3년 지분 변동 전부"*

→ `get_major_holdings(corp="삼성전자")`

```
majorstock(5%룰): 41건 — 최근: 삼성물산 19.70% (2026-04-17)
elestock(임원·주요주주): 200건 반환 (2,615건 중 최근순)
기간: 2023-04-18 ~ 2026-04-18
```

두 엔드포인트(majorstock + elestock)를 한 호출로 합성 — Python 래퍼는 두 번 호출 + pandas merge 필요.

### 10. 단일기업 버핏 체크리스트 (근거 포함)

**프롬프트**: *"삼성전자 6년 버핏 체크리스트"*

→ `buffett_quality_snapshot(corps=["삼성전자"], years=6)`

```
삼성전자 2020~2025:
- ROE 평균 10.26% (min 4.26 / max 15.69 / stddev 3.58)
- D/E 최근 29.94% / 평균 31.11%
- 매출 CAGR 7.09% · 순이익 CAGR 11.35%

체크리스트 3/4:
  ❌ consistent_high_roe (모든 연도 ROE ≥ 15%)
  ✅ low_debt         (최근 부채비율 ≤ 100%)
  ✅ growing_revenue  (매출 CAGR ≥ 5%)
  ✅ growing_earnings (순이익 CAGR ≥ 5%)
```

### 11. 공시 원문 마크다운 (DART XML → MD)

**프롬프트**: *"삼성전자 최근 자기주식 취득 결정 공시 원문"*

→ `search_disclosures(preset="treasury_buy")` 로 rcept_no 찾고 → `download_document(format="markdown")`

```
원본: 2026-03-18 주요사항보고서(자기주식취득결정)
원본 XML 32,618자 → 마크다운 2,272자 변환 (93% 절감)
# 주요사항보고서(자기주식 취득 결정) / 삼성전자
## 자기주식 취득 결정
| 1. 취득예정주식(주) | 보통주식 | ...
| 3. 취득예상기간 | 시작일 | 2026년 03월 19일 |
```

DART 전용 XML(`dart4.xsd`)을 자체 파서로 heading·테이블 보존 마크다운으로.

### 12. 사업보고서 첨부 → 마크다운 본문

**프롬프트**: *"삼성전자 2023 사업보고서 PDF 본문"*

→ `get_attachments(rcept_no="20240312000736", mode="extract", index=0)`

- PDF 첨부 2.2MB → **921,998자 마크다운 (3.7초)**. LLM 이 "위험요소" 섹션을 직접 검색해 요약 가능.
- [kordoc](https://github.com/chrisryugj/kordoc) 엔진 (HWP/HWPX/PDF/DOCX/XLSX 통합) — **OpenDartReader·dart-fss·기존 DART MCP 6종 어디에도 없는 기능**.

---

## 기존 DART 도구와의 차별점

한국 DART 생태계 조사 결과 (2026-04-18 기준):

| 기능 | OpenDartReader (438⭐, Python) | dart-fss (364⭐, Python) | hypn4/opendart-fss-mcp (85 도구) | RealYoungk/opendart-mcp (83 도구) | **korean-dart-mcp (15 도구)** |
|---|:---:|:---:|:---:|:---:|:---:|
| MCP 네이티브 | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Node.js/TypeScript (npm)** | ❌ | ❌ | ❌ | ❌ | ✅ **(유일)** |
| 엔드포인트 1:1 커버리지 | 대부분 | 공시+재무 | 85개 전부 | 83개 전부 | 83→15 enum 압축 |
| 회사명 자동 해결 | 부분 | 부분 | ✅ (오타·초성) | ✅ | ✅ (SQLite FTS 선적재) |
| XBRL presentation/calculation linkbase | ❌ | ZIP만 | ZIP+taxonomy | ZIP만 | ✅ **자동 markdown + 계산 검증** |
| HWP/PDF 첨부 → 마크다운 | ❌ | ❌ | ❌ | ❌ | ✅ **(유일, kordoc)** |
| `insider_signal` 클러스터 | ❌ | ❌ | ❌ | ❌ | ✅ **(유일)** |
| `disclosure_anomaly` 0-100 스코어 | ❌ | ❌ | ❌ | ❌ | ✅ **(유일)** |
| `buffett_quality_snapshot` 체크리스트 | ❌ | ❌ | ❌ | ❌ | ✅ **(유일)** |
| 90일 자동분할 · 페이지 병렬화 | ❌ | ❌ | ❌ | ❌ | ✅ |
| ZIP slip/bomb 방어 | n/a | n/a | ❌ | ❌ | ✅ |

### 포지셔닝 한 줄

> **Python 래퍼(OpenDartReader · dart-fss)** 는 "quant·백테스터가 Jupyter 에서 DataFrame 으로 쓰는 용",
> **기존 Python DART MCP 6종**은 "LLM 이 DART 원시 JSON 을 그대로 받아보는 용",
> **이 프로젝트**는 한국 DART 생태계에서 **유일하게 LLM 네이티브로 설계된 Node.js MCP** — 83 API 를 15 enum 으로 압축하고, XBRL 완전 파싱 · HWP/PDF 마크다운화 · 내부자/어노말리/버핏 애널리스트 프레임을 **기본 탑재한 유일한 서버**.

### 정직한 약점

- **엔드포인트 1:1 커버리지는 hypn4 (85 도구) / RealYoungk (83 도구) 가 더 넓음** — 희귀 엔드포인트 직접 호출이 필요하면 그쪽이 낫다. 이 프로젝트는 **83→15 압축**이라 자주 쓰는 조합을 제외한 엣지 엔드포인트는 제공하지 않음.
- 한국 DART MCP 시장 전체가 작아서 (최대 9⭐ · 2026-04 기준) 생태계 자체가 아직 초기.

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

### 방법 0: `setup` 마법사 (추천, 30초)

```bash
npx -y korean-dart-mcp setup
```

대화형으로 API 키 입력 → 클라이언트 감지 → 설정 파일 자동 패치. macOS / Linux / Windows 공용. Windows 에선 `cmd /c npx` 래핑까지 자동 처리. 수동 JSON 편집 불필요.

지원: Claude Desktop / Claude Code / Cursor / VS Code / Windsurf / Gemini CLI / Zed / Antigravity.

> **`MODULE_NOT_FOUND` / `Cannot find module ...\build\index.js` 가 뜨면**: 과거에 깨진 글로벌 설치가 남아있는 상태입니다. 아래 중 하나로 해결:
> ```powershell
> # A. 글로벌 구버전 제거 후 재시도 (Windows/Mac/Linux 공통)
> npm uninstall -g korean-dart-mcp
> npx -y korean-dart-mcp@latest setup
>
> # B. 또는 글로벌 무시하고 항상 최신 받아오기
> npx --yes --package=korean-dart-mcp@latest korean-dart-mcp setup
> ```

---

### 방법 1: Claude Code 플러그인 (한 줄 설치)

[Claude Code](https://docs.claude.com/en/docs/claude-code) 사용자는 marketplace 등록 후 `/plugin` 으로 설치하면 끝.

```
/plugin marketplace add chrisryugj/korean-dart-mcp
/plugin install korean-dart
```

설치 시 OpenDART 인증키 입력 프롬프트가 뜸 (한 번만). 이후 15개 DART 도구 자동 활성화.

---

### 방법 2: Claude Desktop / Cursor / Windsurf (수동 설정)

**사전 준비**: [Node.js 20.19.0 이상](https://nodejs.org) 설치 (LTS 권장).

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

> **⚠️ Windows 사용자**: 위 설정으로 fail 이 뜨면 Claude Desktop 이 Windows PATH 의 `.cmd` 확장자를 해석하지 못해 `npx` 를 못 찾는 이슈입니다. 아래처럼 `cmd /c` 로 래핑하세요:
>
> ```json
> {
>   "mcpServers": {
>     "korean-dart": {
>       "command": "cmd",
>       "args": ["/c", "npx", "-y", "korean-dart-mcp"],
>       "env": { "DART_API_KEY": "YOUR_API_KEY" }
>     }
>   }
> }
> ```
>
> 그래도 안 되면: ① Node.js **20.19.0 이상** 설치 여부 확인 (`node --version`), ② 방화벽이 `opendart.fss.or.kr` 차단하는지 확인, ③ 첫 기동 시 corp_code 덤프(11.6만건, 약 5-10초) 다운로드 중이니 10초 정도 기다린 후 재시도.

---

### 방법 3: 내 컴퓨터에 직접 설치 (글로벌)

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
| `search_disclosures` | 공시 검색. `page` / `preset`(22종 자동필터) / `all_pages` **3모드** + 페이지 병렬화 + **90일 자동분할**(v0.9) |
| `get_company` | 기업 개황 (업종·대표자·설립일) |
| `get_financials` | 재무정보. `scope: summary`(주요계정, 단일/다중사) / `full`(전체 BS/IS/CF, 단일사) |
| `download_document` | 공시 원문 → `format: markdown`(DART XML 자체 파서) / `raw` / `text` |
| `get_xbrl` | XBRL. `format: raw` ZIP 해제(보안 가드) / `markdown` whitelist 50태그 / `markdown_full` taxonomy 전체(v0.9) |
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
