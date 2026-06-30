/**
 * 85개 OpenDART op 전수 호출 검증 — 신규 dart_raw 도구로 라우팅(= 새 MCP가 전부 도달함을 증명)
 * + get_securities_filing / get_financial_indicators 엔드투엔드.
 *
 * 실행: DART_API_KEY=... node scripts/smoke-85ops.mjs
 * PASS 기준: DART status 000(정상) 또는 013(무자료) = op명·파라미터 유효 = 엔드포인트 도달.
 */
import { DartClient } from "../build/lib/dart-client.js";
import { dartRawTool } from "../build/tools/dart-raw.js";
import { getSecuritiesFilingTool } from "../build/tools/get-securities-filing.js";
import { getFinancialIndicatorsTool } from "../build/tools/get-financial-indicators.js";

const KEY = process.env.DART_API_KEY;
if (!KEY) { console.error("DART_API_KEY 필요"); process.exit(1); }
const client = new DartClient({ apiKey: KEY });
const resolver = { resolve: (s) => ({ corp_code: /^\d{8}$/.test(s) ? s : "00126380", corp_name: s }) };
const ctx = { client, resolver };

const C = "00126380";           // 삼성전자
const YR = "2023", RC = "11011"; // 사업보고서
const B = "20230101", E = "20231231";
const P = {
  A: { corp_code: C, bsns_year: YR, reprt_code: RC },
  B: { corp_code: C, bgn_de: B, end_de: E },
  C: { corp_code: C },
  D: { corp_code: C, bgn_de: "20240101", end_de: "20240601", page_count: "10" },
  E: { corp_code: C, bsns_year: YR, reprt_code: RC, idx_cl_code: "M210000" },
  F: { corp_code: C, bsns_year: YR, reprt_code: RC, fs_div: "CFS" },
  G: { sj_div: "BS1" },
};
// op → 파라미터 템플릿 / binary 여부.  (rcpt = document/fnlttXbrl 은 rcept_no 동적 주입)
const CATALOG = [
  // DS001 (4)
  ["DS001","list","D"], ["DS001","company","C"],
  ["DS001","document","RCPT_DOC",true], ["DS001","corpCode","NONE",true],
  // DS002 (30)
  ...["stockTotqySttus","tesstkAcqsDspsSttus","alotMatter","irdsSttus","detScritsIsuAcmslt",
      "entrprsBilScritsNrdmpBlce","srtpdPsndbtNrdmpBlce","cprndNrdmpBlce","newCaplScritsNrdmpBlce",
      "cndlCaplScritsNrdmpBlce","pssrpCptalUseDtls","prvsrpCptalUseDtls","accnutAdtorNmNdAdtOpinion",
      "adtServcCnclsSttus","accnutAdtorNonAdtServcCnclsSttus","outcmpnyDrctrNdChangeSttus","hyslrSttus",
      "hyslrChgSttus","mrhlSttus","exctvSttus","empSttus","unrstExctvMendngSttus",
      "drctrAdtAllMendngSttusGmtsckConfmAmount","hmvAuditAllSttus","drctrAdtAllMendngSttusMendngPymntamtTyCl",
      "hmvAuditIndvdlBySttus","hmvAuditIndvdlBySttusV2","indvdlByPay","indvdlByPayV2","otrCprInvstmntSttus"
     ].map(op=>["DS002",op,"A"]),
  // DS003 (7)
  ["DS003","fnlttSinglAcnt","A"], ["DS003","fnlttMultiAcnt","A"], ["DS003","fnlttSinglAcntAll","F"],
  ["DS003","fnlttXbrl","RCPT_XBRL",true], ["DS003","fnlttSinglIndx","E"],
  ["DS003","fnlttCmpnyIndx","E"], ["DS003","xbrlTaxonomy","G"],
  // DS004 (2)
  ["DS004","majorstock","C"], ["DS004","elestock","C"],
  // DS005 (36)
  ...["dfOcr","bsnSp","ctrcvsBgrq","dsRsOcr","bnkMngtPcbg","bnkMngtPcsp","lwstLg","piicDecsn","fricDecsn",
      "pifricDecsn","crDecsn","cvbdIsDecsn","bdwtIsDecsn","exbdIsDecsn","wdCocobdIsDecsn","tsstkAqDecsn",
      "tsstkDpDecsn","tsstkAqTrctrCnsDecsn","tsstkAqTrctrCcDecsn","stkExtrDecsn","cmpDvmgDecsn","cmpDvDecsn",
      "cmpMgDecsn","astInhtrfEtcPtbkOpt","tgastTrfDecsn","tgastInhDecsn","otcprStkInvscrTrfDecsn",
      "otcprStkInvscrInhDecsn","bsnTrfDecsn","bsnInhDecsn","stkrtbdInhDecsn","stkrtbdTrfDecsn",
      "ovLstDecsn","ovDlstDecsn","ovLst","ovDlst"].map(op=>["DS005",op,"B"]),
  // DS006 (6)
  ...["estkRs","bdRs","stkdpRs","mgRs","extrRs","dvRs"].map(op=>["DS006",op,"B"]),
];

const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

// 동적 rcept_no 확보 (document / fnlttXbrl 용): 삼성전자 사업보고서 1건
async function getReceptNo() {
  try {
    const r = await client.getJson("list.json", { corp_code: C, bgn_de:"20240101", end_de:"20240601", pblntf_ty:"A", page_count:"20" });
    const items = r.list ?? [];
    const biz = items.find(i => (i.report_nm||"").includes("사업보고서")) ?? items[0];
    return biz?.rcept_no ?? null;
  } catch { return null; }
}

function passByStatus(s){ return s === "000" || s === "013"; }

const run = async () => {
  const rcpt = await getReceptNo();
  console.log(`동적 rcept_no(삼성 사업보고서) = ${rcpt ?? "(미확보)"}\n`);
  const results = [];
  for (const [grp, op, tpl, bin] of CATALOG) {
    let params;
    if (tpl === "NONE") params = {};
    else if (tpl === "RCPT_DOC") params = rcpt ? { rcept_no: rcpt } : { rcept_no: "00000000000000" };
    else if (tpl === "RCPT_XBRL") params = rcpt ? { rcept_no: rcpt, reprt_code: RC } : { rcept_no:"x", reprt_code: RC };
    else params = P[tpl];
    let status="-", pass=false, note="";
    try {
      const r = await dartRawTool.handler({ operation: op, params, binary: !!bin }, ctx);
      if (bin) { pass = !!r.is_zip; status = r.is_zip ? "ZIP" : "noZIP"; note = `${r.bytes}B`; }
      else { status = r.status ?? "?"; pass = passByStatus(status); note = (r.message||"").slice(0,20); }
    } catch (e) {
      const m = String(e.message||e);
      // getZip 은 무자료 시 [013] 던짐 → op 유효로 간주
      if (/\[013\]/.test(m)) { pass = true; status = "013"; note="(무자료)"; }
      else { status = "ERR"; note = m.slice(0,60); }
    }
    results.push({ grp, op, status, pass });
    process.stdout.write(pass ? "." : "x");
    await sleep(40);
  }
  console.log("\n");
  // 그룹별 집계
  const byGrp = {};
  for (const r of results) { (byGrp[r.grp] ??= {p:0,n:0}); byGrp[r.grp].n++; if(r.pass) byGrp[r.grp].p++; }
  for (const g of ["DS001","DS002","DS003","DS004","DS005","DS006"])
    console.log(`  ${g}: ${byGrp[g].p}/${byGrp[g].n} PASS`);
  const pass = results.filter(r=>r.pass).length;
  console.log(`\n=== dart_raw 경유 전수: ${pass}/${results.length} PASS ===`);
  const fails = results.filter(r=>!r.pass);
  if (fails.length) { console.log("실패/주의:"); for (const f of fails) console.log(`  [${f.grp}] ${f.op} → ${f.status}`); }

  // ── 명명 도구 엔드투엔드 ──
  console.log("\n=== 명명 도구 검증 ===");
  for (const ft of ["equity","debt","depositary_receipt","merger","exchange_transfer","split"]) {
    try { const r = await getSecuritiesFilingTool.handler({ corp:"삼성전자", filing_type:ft, begin:"20230101", end:"20241231" }, ctx);
      console.log(`  get_securities_filing(${ft}) → status=${r.status} items=${r.total_items} groups=${r.group_count}`);
    } catch(e){ console.log(`  get_securities_filing(${ft}) ERR ${e.message}`);} await sleep(40);
  }
  try {
    const fi = await getFinancialIndicatorsTool.handler({ corps:["삼성전자"], bsns_year:"2023", reprt:"annual", category:"all" }, ctx);
    console.log(`  get_financial_indicators(삼성,2023,all) → endpoint=${fi.endpoint} 지표=${fi.indicator_count}개`);
    console.log(`     분류별: ${fi.statuses.map(s=>`${s.category}:${s.count}`).join(", ")}`);
    const sample = fi.indicators.slice(0,4).map(i=>`${i.idx_nm}=${i.idx_val}`).join(" | ");
    console.log(`     샘플: ${sample}`);
  } catch(e){ console.log(`  get_financial_indicators ERR ${e.message}`);}
  try {
    const fi2 = await getFinancialIndicatorsTool.handler({ corps:["삼성전자","SK하이닉스"], bsns_year:"2023", reprt:"annual", category:"stability" }, ctx);
    console.log(`  get_financial_indicators(다중,안정성) → endpoint=${fi2.endpoint} 지표=${fi2.indicator_count}개`);
  } catch(e){ console.log(`  get_financial_indicators(다중) ERR ${e.message}`);}
  console.log("\nDONE");
};
run();
