/**
 * v0.5.0 스모크:
 *   #1 거래소공시(pblntf_ty=I) → get_attachments mode=list supported=false
 *   #2 download_document format=markdown / raw / text 비교
 *   #3 XBRL ZIP → get_xbrl 안내, 일반 ZIP (없으면 스킵)
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
    const ms = Date.now() - t0;
    console.log(`[OK ] ${label} (${ms}ms)`);
    return r;
  } catch (e) {
    console.log(`[ERR] ${label}  ${e.message}`);
    return null;
  }
}

// #1 거래소공시
const r1 = await call("거래소공시 list (거래소공시 미지원 확인)", "get_attachments", {
  rcept_no: "20241223800004",
  mode: "list",
});
console.log(`   supported=${r1?.supported}  count=${r1?.count}`);
console.log(`   reason: ${r1?.unsupported_reason}\n`);

// #2 download_document 포맷별 비교 — 삼성전자 자기주식 결정 공시 (작아서 빠름)
const samsung = resolver.resolve("삼성전자");
const ev = await client.getJson("tsstkAqDecsn.json", {
  corp_code: samsung.corp_code,
  bgn_de: "20230101",
  end_de: "20241231",
});
const rcpSmall = ev.list?.[0]?.rcept_no;
console.log("테스트 공시:", rcpSmall, ev.list?.[0]?.report_nm);

const rRaw = await call("download_document raw", "download_document", {
  rcept_no: rcpSmall,
  format: "raw",
  truncate_at: 300,
});
console.log(`   raw: ${rRaw?.raw_char_count} → ${rRaw?.char_count} (truncated=${rRaw?.truncated})`);
console.log(`   head: ${rRaw?.content?.slice(0, 200).replace(/\n/g, " ")}\n`);

const rMd = await call("download_document markdown", "download_document", {
  rcept_no: rcpSmall,
  format: "markdown",
  truncate_at: 3000,
});
console.log(`   markdown: ${rMd?.raw_char_count} → ${rMd?.char_count} (truncated=${rMd?.truncated})`);
console.log(`   head:\n${rMd?.content?.slice(0, 600)}\n`);

const rText = await call("download_document text", "download_document", {
  rcept_no: rcpSmall,
  format: "text",
  truncate_at: 300,
});
console.log(`   text: ${rText?.char_count} chars`);
console.log(`   head: ${rText?.content?.slice(0, 300).replace(/\s+/g, " ")}\n`);

// #3 XBRL ZIP 안내 — 삼성전자 사업보고서 index=1 (XBRL)
const rZip = await call("XBRL ZIP extract (get_xbrl 안내 기대)", "get_attachments", {
  rcept_no: "20240312000736",
  mode: "extract",
  index: 1,
});
console.log(`   supported=${rZip?.supported}  note: ${rZip?.note}\n`);

process.exit(0);
