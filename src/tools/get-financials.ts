/**
 * get_financials — 주요계정 재무정보 (fnlttSinglAcnt / fnlttMultiAcnt)
 *
 * 매출액·영업이익·당기순이익·자산·부채·자본 등 핵심 계정만.
 * 단일사(1개) → fnlttSinglAcnt, 다중사(≥2) → fnlttMultiAcnt 자동 분기.
 * 전체 재무제표가 필요하면 get_full_financials(P1) 사용.
 *
 * 참고: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019016
 *      https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019017
 */

import { z } from "zod";
import { defineTool, resolveCorp } from "./_helpers.js";

const REPORT_CODE = {
  q1: "11013", // 1분기보고서
  half: "11012", // 반기보고서
  q3: "11014", // 3분기보고서
  annual: "11011", // 사업보고서
} as const;

const Input = z.object({
  corps: z
    .array(z.string().min(1))
    .min(1)
    .describe("회사 배열. 1개면 단일사 API, 2개 이상이면 다중사 비교"),
  year: z
    .number()
    .int()
    .min(2015)
    .describe("사업연도 4자리 (2015 이후 지원)"),
  report: z
    .enum(["q1", "half", "q3", "annual"])
    .default("annual")
    .describe("보고서 종류: q1(1분기)/half(반기)/q3(3분기)/annual(사업)"),
});

export const getFinancialsTool = defineTool({
  name: "get_financials",
  description:
    "기업의 주요 재무계정(매출·영업이익·순이익·자산·부채·자본)을 조회합니다. " +
    "여러 회사 배열로 넘기면 다중사 비교(fnlttMultiAcnt). " +
    "전체 계정이 필요하면 get_full_financials(P1) 이용.",
  input: Input,
  handler: async (ctx, args) => {
    const records = args.corps.map((c) => resolveCorp(ctx.resolver, c));
    const reprt_code = REPORT_CODE[args.report];
    const bsns_year = String(args.year);

    if (records.length === 1) {
      const raw = await ctx.client.getJson<{
        status: string;
        message: string;
        list?: Array<Record<string, string>>;
      }>("fnlttSinglAcnt.json", {
        corp_code: records[0].corp_code,
        bsns_year,
        reprt_code,
      });
      if (raw.status !== "000") {
        throw new Error(`DART 응답 오류 [${raw.status}]: ${raw.message}`);
      }
      return {
        mode: "single",
        resolved: records,
        year: args.year,
        report: args.report,
        items: raw.list ?? [],
      };
    }

    // 다중사: corp_code 를 콤마로 연결
    const corp_code = records.map((r) => r.corp_code).join(",");
    const raw = await ctx.client.getJson<{
      status: string;
      message: string;
      list?: Array<Record<string, string>>;
    }>("fnlttMultiAcnt.json", {
      corp_code,
      bsns_year,
      reprt_code,
    });
    if (raw.status !== "000") {
      throw new Error(`DART 응답 오류 [${raw.status}]: ${raw.message}`);
    }
    return {
      mode: "multi",
      resolved: records,
      year: args.year,
      report: args.report,
      items: raw.list ?? [],
    };
  },
});
