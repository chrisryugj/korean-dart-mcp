/**
 * v0.7.1 핫픽스 검증 smoke
 *
 * Critical fix 6건:
 *  1. Resolver alias — "네이버" → NAVER 본체, "현대차" → 현대자동차 본체
 *  2. dart-xml errorHandler — 사업보고서 markdown 변환 안 죽음
 *  3. get_financials full sj_div 필터 — 디폴트 BS+IS 로 사이즈 절감
 *  4. get_major_holdings 기간+limit — 누적 폭발 방지
 *  5. insider_signal reporters_topn — 분기당 reporters ≤ 5
 *  6. get_attachments outline truncate — outline ≤ 50 항목
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

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) {
    console.log(`[PASS] ${label}  ${detail}`);
    pass++;
  } else {
    console.log(`[FAIL] ${label}  ${detail}`);
    fail++;
  }
}

console.log("\n=== v0.7.1 Critical 핫픽스 검증 ===\n");

// === FIX 1: Resolver alias ===
console.log("\n--- FIX 1: Resolver alias ---");
const r1a = await T("resolve_corp_code").handler({ query: "네이버" }, ctx);
check(
  '"네이버" → NAVER 본체(00266961) 1위',
  r1a.results[0]?.corp_code === "00266961",
  `1위 = ${r1a.results[0]?.corp_name} (${r1a.results[0]?.corp_code})`,
);

const r1b = await T("resolve_corp_code").handler({ query: "현대차" }, ctx);
check(
  '"현대차" → 현대자동차(00164742) 1위',
  r1b.results[0]?.corp_code === "00164742",
  `1위 = ${r1b.results[0]?.corp_name} (${r1b.results[0]?.corp_code})`,
);

// 회귀: 정상 케이스 안 깨짐
const r1c = await T("resolve_corp_code").handler({ query: "삼성전자" }, ctx);
check(
  '"삼성전자" 정상 매칭 회귀',
  r1c.results[0]?.corp_code === "00126380",
  `1위 = ${r1c.results[0]?.corp_name}`,
);

// === FIX 2: download_document markdown ===
console.log("\n--- FIX 2: download_document(markdown) ---");
try {
  const r2 = await T("download_document").handler(
    { rcept_no: "20240312000736", format: "markdown", truncate_at: 3000 },
    ctx,
  );
  check(
    "삼성전자 2023 사업보고서 markdown 변환 안 죽음",
    typeof r2.content === "string" && r2.content.length > 0,
    `char_count=${r2.char_count}, content[0:50]="${r2.content?.slice(0, 50).replace(/\s+/g, " ")}"`,
  );
} catch (e) {
  check("삼성전자 2023 사업보고서 markdown 변환 안 죽음", false, `에러: ${e.message}`);
}

// === FIX 3: get_financials full sj_div 디폴트 ===
console.log("\n--- FIX 3: get_financials full sj_div 디폴트 ---");
const r3a = await T("get_financials").handler(
  { corps: ["삼성전자"], year: 2023, scope: "full" },
  ctx,
);
const sjDivsDefault = new Set((r3a.items ?? []).map((it) => it.sj_div));
check(
  "디폴트 sj_div=BS+IS 만 포함",
  sjDivsDefault.size <= 2 && [...sjDivsDefault].every((d) => d === "BS" || d === "IS"),
  `sj_div=[${[...sjDivsDefault].join(",")}], total=${r3a.total_count}, count=${r3a.count}`,
);

const r3b = await T("get_financials").handler(
  { corps: ["삼성전자"], year: 2023, scope: "full", sj_div: ["BS", "IS", "CF", "CIS", "SCE"] },
  ctx,
);
check(
  "명시적 전체 sj_div 시 더 많은 행 반환",
  r3b.count > r3a.count,
  `전체=${r3b.count} > BS+IS=${r3a.count}`,
);

// === FIX 4: get_major_holdings 기간+limit ===
console.log("\n--- FIX 4: get_major_holdings 기간+limit ---");
const r4 = await T("get_major_holdings").handler({ corp: "삼성전자" }, ctx);
const totalReturned = (r4.results ?? []).reduce((s, x) => s + (x.count ?? 0), 0);
check(
  "삼성전자 디폴트 (최근 3년 + limit 200) — 누적 폭발 안 함",
  totalReturned <= 400 && r4.period?.start && r4.period?.end,
  `period=${r4.period?.start}~${r4.period?.end}, returned_total=${totalReturned}, limits=${(r4.results ?? []).map((x) => `${x.kind}:${x.count}/${x.filtered_count}`).join(",")}`,
);

// === FIX 5: insider_signal reporters_topn ===
console.log("\n--- FIX 5: insider_signal reporters_topn ---");
const r5 = await T("insider_signal").handler(
  { corp: "삼성전자", start: "2026-01-01", end: "2026-04-18" },
  ctx,
);
const maxReporters = Math.max(
  0,
  ...(r5.quarterly_clusters ?? []).map((q) => q.reporters?.length ?? 0),
);
check(
  "삼성전자 1Q26 분기당 reporters ≤ 5 (디폴트 topn)",
  maxReporters <= 5,
  `max_reporters=${maxReporters}, summary.signal=${r5.summary?.signal}`,
);

// === FIX 6: get_attachments outline truncate ===
console.log("\n--- FIX 6: get_attachments outline truncate ---");
try {
  const r6 = await T("get_attachments").handler(
    {
      rcept_no: "20240312000736",
      mode: "extract",
      index: 0,
      truncate_at: 3000,
      outline_max_items: 10,
    },
    ctx,
  );
  const outlineLen = Array.isArray(r6.outline?.items) ? r6.outline.items.length : 0;
  check(
    "삼성전자 사업보고서 PDF outline ≤ 10 (디폴트 잘림 동작)",
    outlineLen <= 10 && r6.outline?.total > 10 && r6.outline?.truncated === true,
    `outline.total=${r6.outline?.total}, items.length=${outlineLen}, truncated=${r6.outline?.truncated}, md.length=${r6.markdown?.length ?? 0}`,
  );
} catch (e) {
  check("get_attachments outline truncate", false, `에러: ${e.message}`);
}

console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail > 0 ? 1 : 0);
