/**
 * dart_raw — OpenDART 임의 엔드포인트 범용 호출(패스스루)
 *
 * enum 도구가 없는 엣지/신규 엔드포인트를 op명 + params 로 직접 호출.
 * 예) DS002 2026 Ver2.0 보수(hmvAuditIndvdlBySttusV2/indvdlByPayV2/indvdlByPay),
 *     DS003 xbrlTaxonomy, 향후 추가되는 모든 신규 op.
 * → 이 도구 1개로 OpenDART 85개 + 미래 엔드포인트 100% 도달.
 *
 * 주의: corp_code 자동해석 없음(회사명→코드는 resolve_corp_code 먼저). crtfc_key 는 클라이언트가 자동 부착.
 */

import { z } from "zod";
import { defineTool } from "./_helpers.js";

/** OpenDART 85개 op 카탈로그 — 오타/미지 op 사전 경고용(블로킹 아님, 신규 op 도 허용). */
const KNOWN_OPS = new Set<string>([
  // DS001 공시정보 (4)
  "list", "company", "document", "corpCode",
  // DS002 정기보고서 주요정보 (30)
  "stockTotqySttus", "tesstkAcqsDspsSttus", "alotMatter", "irdsSttus", "detScritsIsuAcmslt",
  "entrprsBilScritsNrdmpBlce", "srtpdPsndbtNrdmpBlce", "cprndNrdmpBlce", "newCaplScritsNrdmpBlce",
  "cndlCaplScritsNrdmpBlce", "pssrpCptalUseDtls", "prvsrpCptalUseDtls", "accnutAdtorNmNdAdtOpinion",
  "adtServcCnclsSttus", "accnutAdtorNonAdtServcCnclsSttus", "outcmpnyDrctrNdChangeSttus", "hyslrSttus",
  "hyslrChgSttus", "mrhlSttus", "exctvSttus", "empSttus", "unrstExctvMendngSttus",
  "drctrAdtAllMendngSttusGmtsckConfmAmount", "hmvAuditAllSttus", "drctrAdtAllMendngSttusMendngPymntamtTyCl",
  "hmvAuditIndvdlBySttus", "hmvAuditIndvdlBySttusV2", "indvdlByPay", "indvdlByPayV2", "otrCprInvstmntSttus",
  // DS003 재무정보 (7)
  "fnlttSinglAcnt", "fnlttMultiAcnt", "fnlttSinglAcntAll", "fnlttXbrl", "fnlttSinglIndx", "fnlttCmpnyIndx", "xbrlTaxonomy",
  // DS004 지분공시 (2)
  "majorstock", "elestock",
  // DS005 주요사항보고서 (36)
  "dfOcr", "bsnSp", "ctrcvsBgrq", "dsRsOcr", "bnkMngtPcbg", "bnkMngtPcsp", "lwstLg", "piicDecsn", "fricDecsn",
  "pifricDecsn", "crDecsn", "cvbdIsDecsn", "bdwtIsDecsn", "exbdIsDecsn", "wdCocobdIsDecsn", "tsstkAqDecsn",
  "tsstkDpDecsn", "tsstkAqTrctrCnsDecsn", "tsstkAqTrctrCcDecsn", "stkExtrDecsn", "cmpDvmgDecsn", "cmpDvDecsn",
  "cmpMgDecsn", "astInhtrfEtcPtbkOpt", "tgastTrfDecsn", "tgastInhDecsn", "otcprStkInvscrTrfDecsn",
  "otcprStkInvscrInhDecsn", "bsnTrfDecsn", "bsnInhDecsn", "stkrtbdInhDecsn", "stkrtbdTrfDecsn",
  "ovLstDecsn", "ovDlstDecsn", "ovLst", "ovDlst",
  // DS006 증권신고서 주요정보 (6)
  "estkRs", "bdRs", "stkdpRs", "mgRs", "extrRs", "dvRs",
]);

const Input = z.object({
  operation: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .describe(
      "OpenDART operation 명 ('.json'/'.xml' 제외). 예: estkRs, fnlttSinglIndx, indvdlByPayV2, list, company, majorstock",
    ),
  params: z
    .record(z.string(), z.string())
    .default({})
    .describe(
      "crtfc_key 를 제외한 모든 쿼리 파라미터(문자열). 예: {corp_code:'00126380', bsns_year:'2023', reprt_code:'11011', idx_cl_code:'M210000', sj_div:'BS1', bgn_de:'20230101', end_de:'20231231'}",
    ),
  binary: z
    .boolean()
    .default(false)
    .describe(
      "true = ZIP/원문 엔드포인트(corpCode/document/fnlttXbrl 등). 바이너리라 메타데이터(크기·ZIP여부)만 반환",
    ),
});

export const dartRawTool = defineTool({
  name: "dart_raw",
  description:
    "OpenDART 임의 엔드포인트 범용 호출(패스스루). 전용 enum 도구가 없는 엣지/신규 op 를 operation 명 + params 로 직접 호출해 원본 JSON 을 반환. " +
    "DS002 Ver2.0 보수·XBRL택사노미 등 미래 엔드포인트까지 코드수정 없이 도달. corp_code 는 8자리 직접 입력(resolve_corp_code 로 먼저 확인).",
  input: Input,
  handler: async (ctx, args) => {
    const warnings: string[] = [];
    // ⑤ op명 카탈로그 검증 (오타/미지 op 사전 경고, 단 신규 op 도 허용)
    if (!KNOWN_OPS.has(args.operation)) {
      warnings.push(
        `operation='${args.operation}' 가 알려진 OpenDART op 85개 목록에 없습니다. ` +
          `오타이거나 2026+ 신규 엔드포인트일 수 있습니다(신규면 정상 동작).`,
      );
    }
    if (args.binary) {
      const buf = await ctx.client.getZip(`${args.operation}.xml`, args.params);
      return {
        tool: "dart_raw",
        operation: args.operation,
        binary: true,
        bytes: buf.length,
        is_zip: buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b,
        ...(warnings.length ? { warning: warnings.join(" ") } : {}),
      };
    }
    const raw = await ctx.client.getJson<{ status?: string; message?: string }>(
      `${args.operation}.json`,
      args.params,
    );
    // DART '침묵 실패' 방어: corp_code 가 틀려도 에러가 아니라 status 013/빈결과로 옴.
    const cc = args.params.corp_code;
    if (cc && !/^\d{8}$/.test(cc)) {
      warnings.push(
        `corp_code='${cc}' 가 8자리 숫자가 아닙니다. 회사명을 코드 자리에 넣었을 가능성이 높습니다. ` +
          `DART 는 이 경우 에러가 아니라 status 013(무자료)/빈 결과를 돌려주니, resolve_corp_code 로 코드를 먼저 확인하세요.`,
      );
    } else if (raw.status === "013" && cc) {
      warnings.push(
        `status 013(무자료). corp_code='${cc}' 형식은 정상이나 해당 회사·기간·파라미터에 데이터가 없을 수 있습니다(파라미터 재확인 권장).`,
      );
    }
    return {
      tool: "dart_raw",
      operation: args.operation,
      params: args.params,
      status: raw.status ?? null,
      message: raw.message ?? null,
      ...(warnings.length ? { warning: warnings.join(" ") } : {}),
      response: raw,
    };
  },
});
