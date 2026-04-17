/**
 * get_major_holdings — DS004 지분공시 2개 엔드포인트 합성
 *
 *  - majorstock.json : 대량보유 상황보고 (5% 룰)
 *  - elestock.json   : 임원·주요주주 소유보고
 *
 * 두 테이블 모두 특정 사업연도·보고서 코드 파라미터 없이 corp_code 만으로 동작.
 * 두 관점(외부 5%+ 주주 vs 임원 본인 보유)을 한 번에 묶어 지분 구조 전체 뷰 제공.
 */

import { z } from "zod";
import { defineTool, normalizeDate, resolveCorp } from "./_helpers.js";

const Input = z.object({
  corp: z.string().min(1).describe("회사명/종목코드/corp_code"),
  include: z
    .array(z.enum(["majorstock", "elestock"]))
    .optional()
    .describe("조회 대상 (미지정 시 둘 다). majorstock=대량보유 5%룰, elestock=임원·주요주주 본인 보유"),
  start: z
    .string()
    .optional()
    .describe("기간 시작 (YYYY-MM-DD / YYYYMMDD). 미지정 시 최근 3년."),
  end: z
    .string()
    .optional()
    .describe("기간 종료 (미지정 시 오늘)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(2000)
    .default(200)
    .describe("최대 반환 행 수 (각 kind 별). 대형 상장사는 누적 수만 건 → 디폴트 200."),
});

function normalizeRcept(s: string | undefined): string | null {
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  return /^\d{8}$/.test(digits) ? digits : null;
}

function defaultStart(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 3);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

interface DartListResp {
  status: string;
  message: string;
  list?: Array<Record<string, string>>;
}

export const getMajorHoldingsTool = defineTool({
  name: "get_major_holdings",
  description:
    "지분공시 2종 합성 조회: 대량보유(5%룰) + 임원·주요주주 본인 소유. " +
    "내부자·외부 대주주 지분 이력을 한 번에 스냅샷.",
  input: Input,
  handler: async (ctx, args) => {
    const record = resolveCorp(ctx.resolver, args.corp);
    const targets = args.include ?? (["majorstock", "elestock"] as const);
    const startYmd = args.start ? normalizeDate(args.start) : defaultStart();
    const endYmd = args.end ? normalizeDate(args.end) : todayYmd();

    const results = await Promise.all(
      targets.map(async (kind) => {
        try {
          const raw = await ctx.client.getJson<DartListResp>(`${kind}.json`, {
            corp_code: record.corp_code,
          });
          if (raw.status !== "000") {
            return {
              kind,
              status: raw.status,
              message: raw.message,
              total_count: 0,
              count: 0,
              items: [] as Array<Record<string, string>>,
            };
          }
          const all = raw.list ?? [];
          const filtered = all.filter((it) => {
            const ymd = normalizeRcept(it.rcept_dt);
            if (!ymd) return false;
            return ymd >= startYmd && ymd <= endYmd;
          });
          // 최신 순으로 잘라 limit 적용
          filtered.sort((a, b) => String(b.rcept_dt ?? "").localeCompare(String(a.rcept_dt ?? "")));
          const items = filtered.slice(0, args.limit);
          return {
            kind,
            status: raw.status,
            total_count: all.length,
            filtered_count: filtered.length,
            count: items.length,
            truncated: filtered.length > args.limit,
            items,
          };
        } catch (e) {
          return {
            kind,
            error: e instanceof Error ? e.message : String(e),
            total_count: 0,
            count: 0,
            items: [] as Array<Record<string, string>>,
          };
        }
      }),
    );

    return {
      resolved: record,
      period: { start: startYmd, end: endYmd },
      limit: args.limit,
      results,
    };
  },
});
