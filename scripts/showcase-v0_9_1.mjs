/**
 * Showcase v0.9.1 — README 에 실을 "혹 할 만한" 실전 시나리오.
 *
 * 각 시나리오는 LLM 이 실제로 한 프롬프트에서 호출할 법한 도구 조합 & 파라미터.
 * 실제 DART API 를 때려 유효한 결과가 나오는지 확인하고, 핵심 숫자·문장만 stdout 에 출력.
 * README 작성 시 이 출력을 그대로 인용.
 *
 * 실행: node scripts/showcase-v0_9_1.mjs
 */
import "dotenv/config";
import { DartClient } from "../build/lib/dart-client.js";
import { CorpCodeResolver } from "../build/lib/corp-code.js";
import { TOOL_REGISTRY } from "../build/tools/index.js";

const client = new DartClient({ apiKey: process.env.DART_API_KEY });
const resolver = new CorpCodeResolver({});
await resolver.init(client);
const ctx = { client, resolver };

const T = Object.fromEntries(TOOL_REGISTRY.map((t) => [t.name, t]));

let pass = 0;
let fail = 0;

function section(n, title) {
  console.log("\n" + "═".repeat(72));
  console.log(`시나리오 ${n}: ${title}`);
  console.log("═".repeat(72));
}

async function run(label, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    console.log(`✅ ${label} (${ms}ms)`);
    pass++;
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`❌ ${label} (${ms}ms): ${e.message}`);
    fail++;
  }
}

const pad = (n) => (n == null ? "-" : Number(n).toLocaleString("ko-KR"));

// ───────────────────────────────────────────────────────────────
// 1. 버핏식 5년 퀄리티 비교 + 랭킹 (삼성 vs SK하이닉스 vs LG전자)
// ───────────────────────────────────────────────────────────────
section(1, "버핏식 5년 퀄리티 비교 + 자동 랭킹");
await run("buffett_quality_snapshot(corps=3, years=5)", async () => {
  const r = await T.buffett_quality_snapshot.handler(
    { corps: ["삼성전자", "SK하이닉스", "LG전자"], years: 5 },
    ctx,
  );
  console.log("\n기업별 5년 지표:");
  for (const row of r.rows ?? []) {
    console.log(
      `  ${row.corp_name}: ROE ${row.avg_roe_pct}% | D/E ${row.latest_debt_to_equity_pct}% | 매출CAGR ${row.revenue_cagr_pct}% | 순익CAGR ${row.net_income_cagr_pct}% | 체크 ${row.overall_score}`,
    );
  }
  console.log("\n랭킹:");
  for (const [k, v] of Object.entries(r.rankings ?? {})) {
    console.log(`  ${k}: ${v.join(" > ")}`);
  }
});

// ───────────────────────────────────────────────────────────────
// 2. 내부자 매수 클러스터 시그널 (삼성전자 1년)
// ───────────────────────────────────────────────────────────────
section(2, "경영진이 본인 돈으로 매수하고 있는가? (insider_signal)");
await run("insider_signal 삼성전자 1년", async () => {
  const today = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(lastYear.getFullYear() - 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const r = await T.insider_signal.handler(
    {
      corp: "삼성전자",
      start: fmt(lastYear),
      end: fmt(today),
      cluster_threshold: 3,
    },
    ctx,
  );
  console.log(`\n${r.summary_text}`);
  console.log(`신호: ${r.summary?.signal}`);
  console.log(
    `고유 매수자 ${r.summary?.unique_buyers}명 vs 매도자 ${r.summary?.unique_sellers}명, 순증감 ${pad(r.summary?.net_change_shares)}주`,
  );
});

// ───────────────────────────────────────────────────────────────
// 3. 회계 리스크 스코어 (HMM — 대표 분석 타깃)
// ───────────────────────────────────────────────────────────────
section(3, "회계·거버넌스 이상 징후 스코어 (disclosure_anomaly)");
await run("disclosure_anomaly 카카오 3년", async () => {
  const r = await T.disclosure_anomaly.handler(
    { corp: "카카오" },
    ctx,
  );
  console.log(`\n${r.summary_text}`);
  console.log(`점수 ${r.score}/100 → verdict=${r.verdict}`);
  console.log(`정정공시 ${r.stats.amendments}/${r.stats.disclosures_total}건 (${(r.stats.amendment_ratio * 100).toFixed(1)}%)`);
  console.log(`감사인 변동: ${r.stats.auditor_changes}회 (${r.stats.unique_auditors.join(" → ")})`);
});

// ───────────────────────────────────────────────────────────────
// 4. XBRL full 모드 — 삼성전자 전체 계정 + 계산 검증
// ───────────────────────────────────────────────────────────────
section(4, "XBRL 전체 계정 파싱 + 계산 검증 (markdown_full)");
await run("get_xbrl markdown_full 삼성전자 2023", async () => {
  const r = await T.get_xbrl.handler(
    {
      rcept_no: "20240312000736",
      report: "annual",
      format: "markdown_full",
      fs_div: "consolidated",
      sections: ["BS", "IS", "CF"],
    },
    ctx,
  );
  console.log(`\n기간: 당기=${r.periods?.current?.end} / 전기=${r.periods?.prior?.end} / 전전기=${r.periods?.priorPrior?.end}`);
  console.log(`계정 수: BS ${r.statements?.BS?.rows?.length}행 · IS ${r.statements?.IS?.rows?.length}행 · CF ${r.statements?.CF?.rows?.length}행`);
  console.log(`마크다운 크기: ${r.markdown?.length.toLocaleString("ko-KR")}자`);
  console.log(`계산 검증: ${r.validations?.length === 0 ? "✅ 모두 일치" : `⚠️ ${r.validations?.length}건 불일치`}`);
  console.log(`taxonomy roles: presentation ${r.meta?.presentation_roles}개 · calculation ${r.meta?.calculation_roles}개`);
});

// ───────────────────────────────────────────────────────────────
// 5. XBRL full — 금융지주 업종별 택소노미 (신한지주 DX prefix)
// ───────────────────────────────────────────────────────────────
section(5, "업종별 XBRL 택소노미 자동 대응 (금융지주)");
await run("get_xbrl markdown_full 신한지주 최신 사업보고서", async () => {
  // 신한지주 최신 사업보고서 rcept_no 를 동적으로 조회
  const list = await T.search_disclosures.handler(
    { corp: "신한지주", preset: "annual_report", days: 365, limit: 1 },
    ctx,
  );
  const first = list.items?.[0];
  if (!first) throw new Error("신한지주 최신 사업보고서 없음");
  console.log(`\n사용 rcept_no: ${first.rcept_no} (${first.rcept_dt} ${first.report_nm})`);
  const r = await T.get_xbrl.handler(
    {
      rcept_no: first.rcept_no,
      report: "annual",
      format: "markdown_full",
      fs_div: "consolidated",
      sections: ["BS", "IS"],
    },
    ctx,
  );
  console.log(`신한지주: BS ${r.statements?.BS?.rows?.length ?? 0}행 · IS ${r.statements?.IS?.rows?.length ?? 0}행`);
  console.log(`계산 검증 위반: ${r.validations?.length}건`);
  console.log(`→ 금융사 전용 DX prefix taxonomy 를 코드 변경 없이 자동 처리`);
});

// ───────────────────────────────────────────────────────────────
// 6. 최근 30일 자기주식 취득 결정 공시 전수 (preset)
// ───────────────────────────────────────────────────────────────
section(6, "최근 30일 자기주식 취득 결정 상장사 전부");
await run("search_disclosures preset=treasury_buy, 30일", async () => {
  const r = await T.search_disclosures.handler(
    { preset: "treasury_buy", days: 30, limit: 500 },
    ctx,
  );
  console.log(`\n매칭 공시 ${r.matched}건 / 페이지 수집 ${r.pages_fetched}페이지`);
  console.log(`상위 5건:`);
  for (const it of (r.items ?? []).slice(0, 5)) {
    console.log(`  ${it.rcept_dt} ${it.corp_name} — ${it.report_nm}`);
  }
});

// ───────────────────────────────────────────────────────────────
// 7. 90일 자동분할 — 전체시장 180일 사업보고서 (v0.9 신기능)
// ───────────────────────────────────────────────────────────────
section(7, "전체시장 >90일 자동분할 (v0.9 신기능)");
await run("search_disclosures 180일 preset=annual_report (auto-split)", async () => {
  const r = await T.search_disclosures.handler(
    { preset: "annual_report", days: 180, limit: 100 },
    ctx,
  );
  console.log(`\n자동분할: ${r.chunks ?? 1} chunks`);
  console.log(`총 수집 ${r.total_fetched}건 → 사업보고서 매칭 ${r.matched}건`);
  console.log(`상위 3건:`);
  for (const it of (r.items ?? []).slice(0, 3)) {
    console.log(`  ${it.rcept_dt} ${it.corp_name} ${it.report_nm}`);
  }
});

// ───────────────────────────────────────────────────────────────
// 8. 자본 이벤트 타임라인 (LG에너지솔루션 2년)
// ───────────────────────────────────────────────────────────────
section(8, "자본 이벤트 타임라인 (get_corporate_event mode=timeline)");
await run("get_corporate_event timeline 카카오 3년", async () => {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 3);
  const r = await T.get_corporate_event.handler(
    {
      corp: "카카오",
      mode: "timeline",
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    },
    ctx,
  );
  const events = r.timeline ?? r.events ?? [];
  console.log(`\n자본 관련 이벤트 총 ${events.length}건`);
  const byType = {};
  for (const e of events) {
    const key = e.event_type ?? e.type ?? e.category ?? "(unknown)";
    byType[key] = (byType[key] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(byType).slice(0, 8)) {
    console.log(`  ${k}: ${v}건`);
  }
  // 샘플 3건
  for (const e of events.slice(0, 3)) {
    console.log(`  예: ${e.rcept_dt ?? ""} ${e.report_nm ?? e.title ?? ""}`);
  }
});

// ───────────────────────────────────────────────────────────────
// 9. 사업보고서 첨부 PDF → 마크다운 (원문 드릴다운)
// ───────────────────────────────────────────────────────────────
section(9, "사업보고서 첨부 PDF → 마크다운 원문 추출");
await run("get_attachments mode=list 삼성전자 2023 사업보고서", async () => {
  // 삼성전자 2023 사업보고서 rcept_no
  const r = await T.get_attachments.handler(
    { rcept_no: "20240312000736", mode: "list" },
    ctx,
  );
  console.log(`\n첨부 ${r.count}개:`);
  for (const a of (r.attachments ?? []).slice(0, 5)) {
    console.log(`  [${a.index}] ${a.filename} (${a.format})`);
  }
  console.log(`→ mode=extract, index=N 으로 kordoc 파싱해 본문 마크다운 확보`);
});

// ───────────────────────────────────────────────────────────────
// 10. 지분공시 통합 (5%룰 + 임원·주요주주 본인 지분)
// ───────────────────────────────────────────────────────────────
section(10, "지분공시 통합 — 5%룰 + 임원 지분 (get_major_holdings)");
await run("get_major_holdings 삼성전자 3년", async () => {
  const r = await T.get_major_holdings.handler(
    { corp: "삼성전자" },
    ctx,
  );
  console.log(`\n기간: ${r.period?.start}~${r.period?.end}`);
  console.log(`전체 결과 키: ${Object.keys(r).join(", ")}`);
  // 구조 확인용: 가능한 필드명 탐색
  const flat = JSON.stringify(r).slice(0, 600);
  console.log(`응답 샘플: ${flat}`);
});

// ───────────────────────────────────────────────────────────────
// 11. 버핏 단일기업 + 체크리스트 근거 (삼성전자 10년)
// ───────────────────────────────────────────────────────────────
section(11, "단일기업 6년 버핏 체크리스트 (근거 포함)");
await run("buffett_quality_snapshot corps=1, years=6", async () => {
  const r = await T.buffett_quality_snapshot.handler(
    { corps: ["삼성전자"], years: 6 },
    ctx,
  );
  // 단일: mode="single", 스냅샷 필드가 평평하게 spread
  console.log(`\n${r.resolved?.corp_name} 최근 ${r.window?.years}년 (${r.window?.start_year}~${r.window?.end_year}):`);
  console.log(`  ROE 평균 ${r.ratios?.avg_roe_pct}% (min ${r.ratios?.min_roe_pct} / max ${r.ratios?.max_roe_pct} / stddev ${r.ratios?.roe_stddev})`);
  console.log(`  D/E 최근 ${r.ratios?.latest_debt_to_equity_pct}% · 평균 ${r.ratios?.avg_debt_to_equity_pct}%`);
  console.log(`  매출 CAGR ${r.ratios?.revenue_cagr_pct}% · 순이익 CAGR ${r.ratios?.net_income_cagr_pct}%`);
  console.log(`  체크리스트 ${r.overall_score}:`);
  for (const [k, v] of Object.entries(r.checklist ?? {})) {
    console.log(`    ${v.pass ? "✅" : "❌"} ${k} — ${v.rule}`);
  }
});

// ───────────────────────────────────────────────────────────────
// 12. 공시 원문 마크다운 (DART XML → markdown)
// ───────────────────────────────────────────────────────────────
section(12, "공시 원문 마크다운 (download_document format=markdown)");
await run("download_document 삼성 자기주식 취득", async () => {
  // 최근 자기주식 취득 결정 하나 찾아서 원문 마크다운 (days 최대 365)
  const list = await T.search_disclosures.handler(
    { corp: "삼성전자", preset: "treasury_buy", days: 365, limit: 1 },
    ctx,
  );
  const first = list.items?.[0];
  if (!first) {
    console.log("최근 2년 자기주식 취득 공시 없음 (skip)");
    return;
  }
  const r = await T.download_document.handler(
    { rcept_no: first.rcept_no, format: "markdown", truncate_at: 3000 },
    ctx,
  );
  console.log(`\n원본: ${first.rcept_dt} ${first.report_nm}`);
  console.log(`원본 XML ${r.raw_char_count.toLocaleString()}자 → 마크다운 ${r.char_count.toLocaleString()}자 변환`);
  console.log(`\n마크다운 미리보기 (앞 400자):\n${r.content.slice(0, 400).replace(/\n+/g, " / ")}`);
});

console.log("\n" + "═".repeat(72));
console.log(`총 ${pass}/${pass + fail} 시나리오 성공`);
console.log("═".repeat(72));
