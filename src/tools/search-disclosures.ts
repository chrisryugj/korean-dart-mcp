/**
 * search_disclosures — 공시 목록 검색 (list.json)
 *
 * OpenDART 공시검색 엔드포인트 래핑. corp_code 없이 전체 공시 검색도 가능.
 * 참고: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018
 */

import { z } from "zod";
import { defineTool, normalizeDate, resolveCorp } from "./_helpers.js";

// OpenDART 상위 공시유형 코드 (pblntf_ty)
const KIND_MAP = {
  periodic: "A", // 정기공시
  major: "B", // 주요사항보고
  issuance: "C", // 발행공시
  holdings: "D", // 지분공시
  other: "E", // 기타공시
  audit: "F", // 외부감사관련
  fund: "G", // 펀드공시
  abs: "H", // 자산유동화
  exchange: "I", // 거래소공시
  ftc: "J", // 공정위공시
} as const;

const Input = z.object({
  corp: z
    .string()
    .optional()
    .describe("회사명/종목코드/corp_code. 생략 시 전체 공시 검색"),
  begin: z
    .string()
    .optional()
    .describe("시작일 YYYY-MM-DD (생략 시 최근 3개월 전)"),
  end: z.string().optional().describe("종료일 YYYY-MM-DD (생략 시 오늘)"),
  kind: z
    .enum(
      Object.keys(KIND_MAP) as [keyof typeof KIND_MAP, ...(keyof typeof KIND_MAP)[]],
    )
    .optional()
    .describe(
      "공시유형 그룹: periodic(정기)/major(주요사항)/issuance(발행)/holdings(지분)/audit(감사)/other/fund/abs/exchange/ftc",
    ),
  final_only: z
    .boolean()
    .default(false)
    .describe("최종보고서만 반환 (정정공시 제외)"),
  page: z.number().int().min(1).default(1),
  size: z.number().int().min(1).max(100).default(20),
});

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export const searchDisclosuresTool = defineTool({
  name: "search_disclosures",
  description:
    "DART 공시 목록을 검색합니다. 회사명 또는 기간·공시유형으로 필터링. " +
    "rcp_no(접수번호)를 얻어 download_document 로 원문 조회 가능.",
  input: Input,
  handler: async (ctx, args) => {
    const params: Record<string, string | number | undefined> = {
      page_no: args.page,
      page_count: args.size,
    };

    if (args.corp) {
      const record = resolveCorp(ctx.resolver, args.corp);
      params.corp_code = record.corp_code;
    }
    // DART list.json 은 날짜 미지정 시 당일만 반환. 기본값을 넉넉히.
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    params.bgn_de = args.begin ? normalizeDate(args.begin) : toYmd(threeMonthsAgo);
    params.end_de = args.end ? normalizeDate(args.end) : toYmd(today);
    if (args.kind) params.pblntf_ty = KIND_MAP[args.kind];
    if (args.final_only) params.last_reprt_at = "Y";

    const raw = await ctx.client.getJson<{
      status: string;
      message: string;
      page_no?: number;
      page_count?: number;
      total_count?: number;
      total_page?: number;
      list?: Array<Record<string, string>>;
    }>("list.json", params);

    if (raw.status !== "000") {
      throw new Error(`DART 응답 오류 [${raw.status}]: ${raw.message}`);
    }

    return {
      total_count: raw.total_count ?? 0,
      page: raw.page_no ?? args.page,
      total_pages: raw.total_page ?? 1,
      items: raw.list ?? [],
    };
  },
});
