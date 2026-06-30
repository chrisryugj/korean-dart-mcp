/**
 * get_financial_indicators — DS003 주요 재무지표 (단일/다중)
 *
 * fnlttSinglIndx(2022001) / fnlttCmpnyIndx(2022002) 를 1개 도구로.
 * 부채비율·유동비율·ROE·영업이익률 등을 *사전계산값(idx_val)* 으로 제공 →
 * 원본 재무제표(fnlttSinglAcntAll)에서 직접 계산할 필요 없음.
 *
 * 핵심: OpenDART 는 idx_cl_code(지표분류)를 한 번에 1개만 받으므로,
 *       category="all" 이면 4분류(수익성/안정성/성장성/활동성)를 병렬 호출 후 병합.
 *       회사 1개 → fnlttSinglIndx, 2개+ → fnlttCmpnyIndx(corp_code 콤마 결합).
 */

import { z } from "zod";
import { defineTool, resolveCorp } from "./_helpers.js";

const IDX_CL: Record<string, { code: string; ko: string }> = {
  profitability: { code: "M210000", ko: "수익성지표" },
  stability: { code: "M220000", ko: "안정성지표" },
  growth: { code: "M230000", ko: "성장성지표" },
  activity: { code: "M240000", ko: "활동성지표" },
};
const REPRT: Record<string, string> = {
  annual: "11011",
  half: "11012",
  q1: "11013",
  q3: "11014",
};

const Input = z.object({
  corps: z
    .array(z.string().min(1))
    .min(1)
    .describe("회사명/종목코드/corp_code 배열. 1개=fnlttSinglIndx, 2개+=fnlttCmpnyIndx"),
  bsns_year: z.string().regex(/^\d{4}$/).describe("사업연도 4자리 (2023년 3분기~ 제공)"),
  reprt: z
    .enum(["annual", "half", "q1", "q3"])
    .default("annual")
    .describe("annual(사업보고서)/half(반기)/q1(1분기)/q3(3분기)"),
  category: z
    .enum(["profitability", "stability", "growth", "activity", "all"])
    .default("all")
    .describe("지표분류: profitability/stability/growth/activity 또는 all(4종 병렬 호출 후 병합)"),
});

interface IndxResp {
  status: string;
  message: string;
  list?: Array<Record<string, string>>;
}

/** OpenDART 1-건 응답이 배열 대신 단일 객체로 오는 quirk 방어. */
function toArray<T>(x: T[] | T | undefined | null): T[] {
  return Array.isArray(x) ? x : x != null ? [x] : [];
}

type Pivot = Array<{ category_ko: string; idx_nm: string; values: Record<string, string | null> }>;

/** 지표×회사 피벗을 분류별 GitHub 마크다운 표로 렌더 (LLM/사용자 바로 표시용). */
function renderMarkdown(companies: Array<{ corp_code: string; corp_name: string }>, pivot: Pivot): string {
  if (!pivot.length) return "(조회된 지표 없음)";
  const header = `| 지표 | ${companies.map((c) => c.corp_name).join(" | ")} |`;
  const sep = `|---|${companies.map(() => "---:").join("|")}|`;
  const byCat = new Map<string, Pivot>();
  for (const p of pivot) {
    const arr = byCat.get(p.category_ko) ?? [];
    arr.push(p);
    byCat.set(p.category_ko, arr);
  }
  const blocks: string[] = [];
  for (const [cat, rows] of byCat) {
    const lines = rows.map(
      (r) => `| ${r.idx_nm} | ${companies.map((c) => r.values[c.corp_code] ?? "-").join(" | ")} |`,
    );
    blocks.push(`#### ${cat}\n${header}\n${sep}\n${lines.join("\n")}`);
  }
  return blocks.join("\n\n");
}

export const getFinancialIndicatorsTool = defineTool({
  name: "get_financial_indicators",
  description:
    "DS003 주요 재무지표(수익성·안정성·성장성·활동성)를 사전계산값으로 조회. " +
    "corps 1개=단일회사(fnlttSinglIndx), 2개+=다중회사(fnlttCmpnyIndx). " +
    "category='all' 이면 4분류를 병렬 호출해 병합. 원본 재무제표 없이 부채비율·ROE·영업이익률 등을 바로 획득.",
  input: Input,
  handler: async (ctx, args) => {
    const records = args.corps.map((c) => resolveCorp(ctx.resolver, c));
    const op = records.length === 1 ? "fnlttSinglIndx" : "fnlttCmpnyIndx";
    const reprt_code = REPRT[args.reprt];
    const corp_code = records.map((r) => r.corp_code).join(",");
    const cats =
      args.category === "all" ? (Object.keys(IDX_CL) as string[]) : [args.category];

    const results = await Promise.all(
      cats.map(async (cat) => {
        const r = await ctx.client.getJson<IndxResp>(`${op}.json`, {
          corp_code,
          bsns_year: args.bsns_year,
          reprt_code,
          idx_cl_code: IDX_CL[cat].code,
        });
        return {
          category: cat,
          status: r.status,
          message: r.message,
          rows: toArray<Record<string, string>>(r.list),
        };
      }),
    );

    // 지표 × 회사 피벗 (idx_code 로 병합 → 행=지표, 열=회사). 다중회사 비교 가독성↑
    const companies = records.map((r) => ({ corp_code: r.corp_code, corp_name: r.corp_name }));
    const pivotMap = new Map<
      string,
      {
        category: string;
        category_ko: string;
        idx_code: string;
        idx_nm: string;
        stlm_dt: string | null;
        values: Record<string, string | null>;
      }
    >();
    let dataPoints = 0;
    for (const res of results) {
      for (const row of res.rows) {
        const key = row.idx_code || `${res.category}:${row.idx_nm}`;
        let p = pivotMap.get(key);
        if (!p) {
          p = {
            category: res.category,
            category_ko: IDX_CL[res.category].ko,
            idx_code: row.idx_code ?? "",
            idx_nm: row.idx_nm ?? "",
            stlm_dt: row.stlm_dt ?? null,
            values: {},
          };
          pivotMap.set(key, p);
        }
        p.values[row.corp_code ?? "?"] = row.idx_val ?? null;
        dataPoints++;
      }
    }
    const pivot = [...pivotMap.values()];

    // DART '침묵 실패' 방어: 무자료면 입력 점검 안내
    const note =
      dataPoints === 0
        ? `조회된 지표 없음. corp_code(${companies.map((c) => c.corp_code).join(",")})·사업연도(${args.bsns_year}, 2023~만 제공)·보고서코드(${reprt_code}) 확인. ` +
          `corp_code 가 8자리가 아니면 회사명을 잘못 넣은 것일 수 있습니다(DART 는 이 경우 status 013).`
        : undefined;

    return {
      tool: "get_financial_indicators",
      endpoint: op,
      companies,
      bsns_year: args.bsns_year,
      reprt_code,
      categories: cats,
      statuses: results.map((r) => ({
        category: r.category,
        status: r.status,
        message: r.message,
        count: r.rows.length,
      })),
      data_points: dataPoints,
      indicator_rows: pivot.length,
      ...(note ? { note } : {}),
      pivot,
      markdown: renderMarkdown(companies, pivot),
    };
  },
});
