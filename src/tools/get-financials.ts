/**
 * get_financials — 재무정보 통합 (주요계정 summary + 전체 재무제표 full)
 *
 * scope="summary" (기본): fnlttSinglAcnt / fnlttMultiAcnt 주요계정
 *   - corps 1개 → 단일사 API
 *   - corps 2+  → 다중사 비교 API
 * scope="full": fnlttSinglAcntAll 전체 재무제표 (수백~천여 행)
 *   - corps 1개 전용 (여러 개면 에러)
 *   - fs 로 연결(CFS) / 별도(OFS) 선택
 *
 * 참고:
 *   summary: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019016
 *   full:    https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020
 */

import { z } from "zod";
import { defineTool, resolveCorp } from "./_helpers.js";

const REPORT_CODE = {
  q1: "11013",
  half: "11012",
  q3: "11014",
  annual: "11011",
} as const;

const FS_DIV = {
  consolidated: "CFS",
  separate: "OFS",
} as const;

const Input = z
  .object({
    corps: z
      .array(z.string().min(1))
      .min(1)
      .describe("회사 배열. scope=summary 면 1개(단일) 또는 2+(다중사 비교). full 은 1개만."),
    year: z.number().int().min(2015),
    report: z
      .enum(["q1", "half", "q3", "annual"])
      .default("annual")
      .describe("q1/half/q3/annual"),
    scope: z
      .enum(["summary", "full"])
      .default("summary")
      .describe(
        "summary: 주요계정 8~10행 (빠름). full: 전체 재무제표(BS/IS/CF/CIS/SCE) 수백~천여 행",
      ),
    fs: z
      .enum(["consolidated", "separate"])
      .default("consolidated")
      .describe("scope=full 시 연결(consolidated)/별도(separate) 선택"),
    sj_div: z
      .array(z.enum(["BS", "IS", "CF", "CIS", "SCE"]))
      .optional()
      .describe(
        "scope=full 시 재무제표 종류 필터 (미지정 시 BS+IS — 기본 응답 사이즈 ~70% 절감). " +
          "BS=재무상태표, IS=손익계산서, CF=현금흐름표, CIS=포괄손익계산서, SCE=자본변동표. " +
          "전체 받으려면 [\"BS\",\"IS\",\"CF\",\"CIS\",\"SCE\"] 명시.",
      ),
  })
  .refine((v) => v.scope !== "full" || v.corps.length === 1, {
    message: "scope=full 은 corps 1개만 지원 (다중사 전체 재무제표 API 없음)",
  });

interface DartRawResp {
  status: string;
  message: string;
  list?: Array<Record<string, string>>;
}

export const getFinancialsTool = defineTool({
  name: "get_financials",
  description:
    "재무정보 조회 — scope=summary(주요계정, 단일/다중사 자동) 또는 full(전체 재무제표, 단일사). " +
    "summary 는 매출·영업이익·당기순이익·자산/부채/자본 핵심만, full 은 BS/IS/CF 전체 수백 행.",
  input: Input,
  handler: async (ctx, args) => {
    const records = args.corps.map((c) => resolveCorp(ctx.resolver, c));
    const reprt_code = REPORT_CODE[args.report];
    const bsns_year = String(args.year);

    if (args.scope === "full") {
      const raw = await ctx.client.getJson<DartRawResp>("fnlttSinglAcntAll.json", {
        corp_code: records[0].corp_code,
        bsns_year,
        reprt_code,
        fs_div: FS_DIV[args.fs],
      });
      if (raw.status !== "000") {
        throw new Error(`DART 응답 오류 [${raw.status}]: ${raw.message}`);
      }
      const allItems = raw.list ?? [];
      const filterDivs: ReadonlyArray<string> = args.sj_div ?? ["BS", "IS"];
      const filterSet = new Set<string>(filterDivs);
      const items = allItems.filter((it) => filterSet.has(String(it.sj_div)));
      return {
        mode: "full",
        resolved: records,
        year: args.year,
        report: args.report,
        fs: args.fs,
        sj_div_filter: filterDivs,
        total_count: allItems.length,
        count: items.length,
        items,
      };
    }

    // summary 모드
    if (records.length === 1) {
      const raw = await ctx.client.getJson<DartRawResp>("fnlttSinglAcnt.json", {
        corp_code: records[0].corp_code,
        bsns_year,
        reprt_code,
      });
      if (raw.status !== "000") {
        throw new Error(`DART 응답 오류 [${raw.status}]: ${raw.message}`);
      }
      return {
        mode: "summary_single",
        resolved: records,
        year: args.year,
        report: args.report,
        items: raw.list ?? [],
      };
    }

    // 다중사 — corp_code 콤마 연결
    const corp_code = records.map((r) => r.corp_code).join(",");
    const raw = await ctx.client.getJson<DartRawResp>("fnlttMultiAcnt.json", {
      corp_code,
      bsns_year,
      reprt_code,
    });
    if (raw.status !== "000") {
      throw new Error(`DART 응답 오류 [${raw.status}]: ${raw.message}`);
    }
    return {
      mode: "summary_multi",
      resolved: records,
      year: args.year,
      report: args.report,
      items: raw.list ?? [],
    };
  },
});
