/**
 * get_securities_filing — DS006 증권신고서 주요정보 6종 enum
 *
 * OpenDART DS006 (지분증권·채무증권·증권예탁증권·합병·분할·주식의포괄적교환이전 신고서)은
 * 기존 MCP 가 전혀 커버하지 않던 그룹. 6개 op 를 1개 enum 도구로 압축.
 *
 * 공통 파라미터: corp_code, bgn_de, end_de (모두 필수, 2015~).
 * 응답: status/message + 다중 group(각 group = title + list[]) 또는 단일 list.
 */

import { z } from "zod";
import { defineTool, normalizeDate, resolveCorp } from "./_helpers.js";

const FILING: Record<string, { endpoint: string; ko: string }> = {
  equity: { endpoint: "estkRs", ko: "지분증권" },
  debt: { endpoint: "bdRs", ko: "채무증권" },
  depositary_receipt: { endpoint: "stkdpRs", ko: "증권예탁증권(DR)" },
  merger: { endpoint: "mgRs", ko: "합병" },
  exchange_transfer: { endpoint: "extrRs", ko: "주식의 포괄적 교환·이전" },
  split: { endpoint: "dvRs", ko: "분할" },
};
const FILING_TYPES = Object.keys(FILING) as [string, ...string[]];

interface DartGroupResp {
  status: string;
  message: string;
  list?: Array<Record<string, string>>;
  group?: Array<{ title?: string; list?: Array<Record<string, string>> }>;
}

/**
 * OpenDART quirk 방어: 결과가 1건일 때 배열이 아닌 단일 객체로 오는 경우가 있음.
 * (DS006 은 실측상 1건도 array[1] 로 오지만, 엔드포인트별 편차가 있어 일괄 정규화)
 */
function toArray<T>(x: T[] | T | undefined | null): T[] {
  return Array.isArray(x) ? x : x != null ? [x] : [];
}

const Input = z.object({
  corp: z.string().min(1).describe("회사명/종목코드/corp_code"),
  filing_type: z
    .enum(FILING_TYPES)
    .describe(
      "증권신고서 유형: equity(지분증권)/debt(채무증권)/depositary_receipt(예탁증권DR)/merger(합병)/exchange_transfer(주식의포괄적교환·이전)/split(분할)",
    ),
  begin: z.string().describe("시작 접수일 YYYY-MM-DD 또는 YYYYMMDD (2015~)"),
  end: z.string().optional().describe("종료 접수일 (생략 시 begin 과 동일)"),
});

export const getSecuritiesFilingTool = defineTool({
  name: "get_securities_filing",
  description:
    "DS006 증권신고서 주요정보 6종을 enum 으로 조회. " +
    "filing_type: equity(지분증권)/debt(채무증권)/depositary_receipt(DR)/merger(합병)/exchange_transfer(주식교환·이전)/split(분할). " +
    "유상증자·회사채·합병·분할·IPO 신고서의 구조화 데이터(발행조건·인수인·자금사용목적·외부평가 등)를 반환.",
  input: Input,
  handler: async (ctx, args) => {
    const record = resolveCorp(ctx.resolver, args.corp);
    const meta = FILING[args.filing_type];
    const bgn_de = normalizeDate(args.begin);
    const end_de = args.end ? normalizeDate(args.end) : bgn_de;

    const raw = await ctx.client.getJson<DartGroupResp>(`${meta.endpoint}.json`, {
      corp_code: record.corp_code,
      bgn_de,
      end_de,
    });

    // 응답 정규화: group[] 우선, 없으면 단일 list. (배열/단일객체 모두 수용)
    const rawGroups = toArray(raw.group);
    const groups = rawGroups.length
      ? rawGroups.map((g) => {
          const items = toArray<Record<string, string>>(g.list);
          return { title: g.title ?? null, count: items.length, items };
        })
      : (() => {
          const items = toArray<Record<string, string>>(raw.list);
          return items.length ? [{ title: null, count: items.length, items }] : [];
        })();

    const total_items = groups.reduce((a, g) => a + g.count, 0);
    const note =
      raw.status === "013" || total_items === 0
        ? `해당 기간(${bgn_de}~${end_de})에 '${meta.ko}' 증권신고서가 없습니다. ` +
          `corp_code(${record.corp_code})는 정상 해석됨 — 기간/유형을 바꿔보세요. ` +
          `(증권신고서는 발행이 드물 수 있습니다.)`
        : undefined;
    return {
      tool: "get_securities_filing",
      filing_type: args.filing_type,
      filing_ko: meta.ko,
      endpoint: meta.endpoint,
      resolved: record,
      period: { start: bgn_de, end: end_de },
      status: raw.status,
      message: raw.message,
      group_count: groups.length,
      total_items,
      ...(note ? { note } : {}),
      groups,
    };
  },
});
