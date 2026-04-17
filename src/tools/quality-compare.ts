/**
 * quality_compare — 여러 기업의 퀄리티 지표를 한 번에 비교 + 랭킹
 *
 * `buffett_quality_snapshot` 을 각 기업에 병렬 적용하고, 핵심 metric 만 뽑아
 * 표 + 지표별 순위로 정리. 동종업계 비교·포트폴리오 스크리닝 용.
 *
 * 내부적으로 `buffettQualitySnapshotTool.handler` 를 재호출 (DRY).
 */

import { z } from "zod";
import { defineTool } from "./_helpers.js";
import { buffettQualitySnapshotTool } from "./buffett-quality-snapshot.js";

const Input = z.object({
  corps: z
    .array(z.string().min(1))
    .min(2)
    .max(10)
    .describe("비교할 회사 2~10개 (회사명/종목코드/corp_code)"),
  years: z
    .number()
    .int()
    .min(3)
    .max(15)
    .default(5)
    .describe("과거 몇 년치 (기본 5년)"),
  end_year: z
    .number()
    .int()
    .min(2016)
    .optional()
    .describe("기준 연도 (미지정 시 작년)"),
});

interface SnapshotResult {
  resolved: { corp_code: string; corp_name: string };
  window: { start_year: number; end_year: number; years: number };
  ratios: {
    avg_roe_pct: number | null;
    roe_stddev: number;
    latest_debt_to_equity_pct: number | null;
    revenue_cagr_pct: number | null;
    net_income_cagr_pct: number | null;
  };
  overall_score: string; // "3/4"
  checklist: Record<string, { pass: boolean }>;
}

function rank<T extends { corp_name: string }>(
  items: T[],
  keyFn: (it: T) => number | null,
  dir: "desc" | "asc",
): string[] {
  const withValue = items
    .map((it) => ({ it, v: keyFn(it) }))
    .filter((x): x is { it: T; v: number } => x.v !== null && Number.isFinite(x.v as number));
  withValue.sort((a, b) => (dir === "desc" ? b.v - a.v : a.v - b.v));
  return withValue.map((x) => `${x.it.corp_name}(${x.v})`);
}

export const qualityCompareTool = defineTool({
  name: "quality_compare",
  description:
    "여러 기업(2~10개) 의 N년 퀄리티 지표(ROE·부채비율·매출/순이익 CAGR·체크리스트 통과 수) 를 병렬 수집 후 비교 표 + 지표별 순위 반환. " +
    "포트폴리오 스크리닝·동종업계 비교 용. 내부적으로 buffett_quality_snapshot 를 각 기업에 적용.",
  input: Input,
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.corps.map(async (corp) => {
        try {
          const r = (await buffettQualitySnapshotTool.handler(
            { corp, years: args.years, end_year: args.end_year, prefer_consolidated: true },
            ctx,
          )) as SnapshotResult;
          return { corp_input: corp, snapshot: r, error: null as string | null };
        } catch (e) {
          return {
            corp_input: corp,
            snapshot: null,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    const rows = results
      .filter((r): r is { corp_input: string; snapshot: SnapshotResult; error: null } => r.snapshot !== null)
      .map((r) => ({
        corp_name: r.snapshot.resolved.corp_name,
        corp_code: r.snapshot.resolved.corp_code,
        window: r.snapshot.window,
        avg_roe_pct: r.snapshot.ratios.avg_roe_pct,
        roe_stddev: r.snapshot.ratios.roe_stddev,
        latest_debt_to_equity_pct: r.snapshot.ratios.latest_debt_to_equity_pct,
        revenue_cagr_pct: r.snapshot.ratios.revenue_cagr_pct,
        net_income_cagr_pct: r.snapshot.ratios.net_income_cagr_pct,
        overall_score: r.snapshot.overall_score,
        checklist_pass: Object.entries(r.snapshot.checklist)
          .filter(([, v]) => v.pass)
          .map(([k]) => k),
      }));

    const rankings = {
      by_avg_roe_desc: rank(rows, (r) => r.avg_roe_pct, "desc"),
      by_debt_ratio_asc: rank(rows, (r) => r.latest_debt_to_equity_pct, "asc"),
      by_revenue_cagr_desc: rank(rows, (r) => r.revenue_cagr_pct, "desc"),
      by_net_income_cagr_desc: rank(rows, (r) => r.net_income_cagr_pct, "desc"),
      by_roe_stability_asc: rank(rows, (r) => r.roe_stddev, "asc"),
    };

    const errors = results
      .filter((r) => r.error)
      .map((r) => ({ corp_input: r.corp_input, error: r.error }));

    return {
      inputs: args.corps,
      years: args.years,
      end_year: args.end_year ?? new Date().getFullYear() - 1,
      rows,
      rankings,
      errors,
      note:
        "순위는 단일 지표 기반 — 실제 판단은 업종·경기·밸류에이션 고려 필수. " +
        "`buffett_quality_snapshot` 로 개별 기업 체크리스트 세부, `insider_signal`/`disclosure_anomaly` 로 질적 시그널 보완.",
    };
  },
});
