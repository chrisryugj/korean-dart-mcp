/**
 * get_company — 기업개황 조회 (company.json)
 *
 * 업종·설립일·대표자·주소·홈페이지 등 기본 정보.
 * 참고: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019002
 */

import { z } from "zod";
import { defineTool, resolveCorp } from "./_helpers.js";

const Input = z.object({
  corp: z
    .string()
    .min(1)
    .describe("회사명/종목코드/corp_code"),
});

export const getCompanyTool = defineTool({
  name: "get_company",
  description:
    "기업의 개황(업종·설립일·대표자·주소·홈페이지·종목코드 등)을 조회합니다.",
  input: Input,
  handler: async (ctx, args) => {
    const record = resolveCorp(ctx.resolver, args.corp);
    const raw = await ctx.client.getJson<Record<string, string>>("company.json", {
      corp_code: record.corp_code,
    });
    if (raw.status !== "000") {
      throw new Error(`DART 응답 오류 [${raw.status}]: ${raw.message}`);
    }
    return {
      resolved: record,
      company: raw,
    };
  },
});
