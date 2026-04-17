/**
 * v0.6.0 스모크:
 *   #4 list_recent_filings — 여러 프리셋 빠른 조회
 *   #5 quality_compare — 여러 기업 N년 비교
 */
import "dotenv/config";
import { DartClient } from "../build/lib/dart-client.js";
import { CorpCodeResolver } from "../build/lib/corp-code.js";
import { TOOL_REGISTRY } from "../build/tools/index.js";

const client = new DartClient({ apiKey: process.env.DART_API_KEY });
const resolver = new CorpCodeResolver({});
await resolver.init(client);
const ctx = { client, resolver };
const T = (n) => TOOL_REGISTRY.find((t) => t.name === n);

async function call(label, name, args) {
  const t0 = Date.now();
  try {
    const r = await T(name).handler(args, ctx);
    console.log(`[OK ] ${label} (${Date.now() - t0}ms)`);
    return r;
  } catch (e) {
    console.log(`[ERR] ${label}  ${e.message}`);
    return null;
  }
}

// #4 list_recent_filings 프리셋 (최근 30일)
for (const preset of ["treasury_buy", "cb_issue", "merger", "large_holding_5pct"]) {
  const r = await call(`list_recent_filings ${preset} 30d`, "list_recent_filings", {
    preset,
    days: 30,
    limit: 5,
  });
  console.log(`   matched=${r?.matched}/${r?.total_fetched} returned=${r?.returned}`);
  r?.items?.slice(0, 3).forEach((it) =>
    console.log(`     ${it.rcept_dt} ${it.corp_name.padEnd(20)} ${it.report_nm}`),
  );
  console.log();
}

// #5 quality_compare — 삼성전자 vs SK하이닉스 vs LG전자
const r5 = await call(
  "quality_compare 삼성/SK하이닉스/LG전자 5년",
  "quality_compare",
  {
    corps: ["삼성전자", "SK하이닉스", "LG전자"],
    years: 5,
  },
);
if (r5) {
  console.log("\n=== 비교 표 ===");
  r5.rows.forEach((r) =>
    console.log(
      `  ${r.corp_name.padEnd(12)}  ROE평균=${r.avg_roe_pct}  D/E=${r.latest_debt_to_equity_pct}  매출CAGR=${r.revenue_cagr_pct}  순이익CAGR=${r.net_income_cagr_pct}  score=${r.overall_score}`,
    ),
  );
  console.log("\n=== 랭킹 ===");
  for (const [k, v] of Object.entries(r5.rankings)) console.log(`  ${k}: ${v.join(" > ")}`);
  if (r5.errors.length) console.log("\n  errors:", r5.errors);
}

process.exit(0);
