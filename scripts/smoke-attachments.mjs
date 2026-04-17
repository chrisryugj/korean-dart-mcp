/**
 * get_attachments 실 DART 검증
 *   1. list   — 삼성전자 사업보고서 첨부 목록
 *   2. extract — 첫 PDF 첨부 마크다운 변환 (pdfjs-dist)
 *   3. HWP 첨부 있는 공시도 찾아 1회 테스트 (주요사항 보고서는 HWP 많음)
 */
import "dotenv/config";
import { DartClient } from "../build/lib/dart-client.js";
import { CorpCodeResolver } from "../build/lib/corp-code.js";
import { TOOL_REGISTRY } from "../build/tools/index.js";

const client = new DartClient({ apiKey: process.env.DART_API_KEY });
const resolver = new CorpCodeResolver({});
await resolver.init(client);
const ctx = { client, resolver };
const tool = TOOL_REGISTRY.find((t) => t.name === "get_attachments");

async function run(label, args) {
  const t0 = Date.now();
  try {
    const r = await tool.handler(args, ctx);
    const ms = Date.now() - t0;
    if (r.attachments) {
      console.log(`[OK ] ${label} (${ms}ms)  count=${r.count}`);
      r.attachments.forEach((a) =>
        console.log(`   [${a.index}] ${a.format.padEnd(5)} ${a.filename}`),
      );
    } else if (r.markdown) {
      const preview = r.markdown.slice(0, 200).replace(/\n/g, " ");
      console.log(
        `[OK ] ${label} (${ms}ms)  ${r.format} ${r.size_bytes}B → md ${r.char_count} chars truncated=${r.truncated}`,
      );
      console.log(`   preview: ${preview}...`);
    } else {
      console.log(`[OK ] ${label} (${ms}ms)  ${JSON.stringify(r).slice(0, 220)}`);
    }
  } catch (e) {
    console.log(`[ERR] ${label}  ${e.message}`);
  }
  console.log();
}

// 1. 삼성전자 사업보고서 rcept_no (P3 단계 debug-viewer 에서 확인한 값)
const samsungAnnual = "20240312000736";
await run("삼성전자 사업보고서 첨부 목록", {
  rcept_no: samsungAnnual,
  mode: "list",
});

// 2. 첫 PDF 추출 (사업보고서 PDF 본문)
await run("삼성전자 사업보고서 PDF 추출 (truncate 2k)", {
  rcept_no: samsungAnnual,
  mode: "extract",
  index: 0,
  truncate_at: 2000,
});

// 3. HWP 첨부 찾기 — 주요사항(B) 또는 기타(E) 에서 다양 회사 시도
const samsung = resolver.resolve("삼성전자");
for (const ty of ["B", "E", "I"]) {
  const page = await client.getJson("list.json", {
    corp_code: samsung.corp_code,
    bgn_de: "20230101",
    end_de: "20241231",
    pblntf_ty: ty,
    page_count: 5,
  });
  const cand = page.list?.[0];
  if (!cand) continue;
  console.log(`--- 삼성전자 유형 ${ty} 후보:`, cand.rcept_no, cand.report_nm);
  await run(`삼성전자 ${ty} 첨부 목록`, { rcept_no: cand.rcept_no, mode: "list" });
}

process.exit(0);
