/**
 * insider_signal — 임원·주요주주 거래 시그널 집계 (킬러 포인트)
 *
 * 기반 데이터: elestock.json (DS004 임원·주요주주 소유보고)
 *
 * 기존 Python 래퍼는 raw 테이블만 반환. 여기서는 버핏·피셔 식 "내부자가 자기 돈으로 사는가" 를
 * 정량화해서 LLM 에 바로 해석 가능한 시그널 단위로 제공:
 *   - 매수자 / 매도자 수
 *   - 순증감 주식수
 *   - 분기 단위 "cluster": N명 이상 같은 방향 거래
 *   - 등기임원 vs 미등기, 임원 vs 주요주주 구분
 *
 * 주의: 이는 투자 권유가 아니라 LLM 이 경영진 시그널을 해석하는 데이터 프레임 제공.
 */

import { z } from "zod";
import { defineTool, normalizeDate, resolveCorp } from "./_helpers.js";

const Input = z.object({
  corp: z.string().min(1).describe("회사명/종목코드/corp_code"),
  start: z.string().optional().describe("기간 시작 (YYYY-MM-DD / YYYYMMDD)"),
  end: z.string().optional().describe("기간 종료"),
  cluster_threshold: z
    .number()
    .int()
    .min(2)
    .default(3)
    .describe("cluster 인정 최소 인원 (기본 3: 분기 내 같은 방향 거래 3명 이상)"),
  reporters_topn: z
    .number()
    .int()
    .min(0)
    .max(50)
    .default(5)
    .describe(
      "분기별 reporters 명단 상위 N (절대값 큰 순). 대형사는 분기당 수백명 → 디폴트 5. 0=빈 배열.",
    ),
});

interface ElestockItem {
  repror?: string;
  isu_exctv_rgist_at?: string; // 등기임원여부
  isu_exctv_ofcps?: string; // 직위
  isu_main_shrholdr?: string; // 주요주주 명
  sp_stock_lmp?: string; // 보유 수량
  sp_stock_lmp_irds_cnt?: string; // 증감 수량 (부호 있음)
  sp_stock_lmp_rate?: string;
  sp_stock_lmp_irds_rate?: string;
  rcept_dt?: string; // 접수일자 YYYYMMDD
  [k: string]: string | undefined;
}

interface DartListResp {
  status: string;
  message: string;
  list?: ElestockItem[];
}

/** "-1,234" 또는 "1234" 같은 문자열 → 숫자. 파싱 실패 시 0. */
function toInt(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** DART는 rcept_dt 를 "YYYY-MM-DD" 또는 "YYYYMMDD" 둘 다 쓴다. 8자리 숫자로 정규화. */
function normalizeRcept(s: string | undefined): string | null {
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  return /^\d{8}$/.test(digits) ? digits : null;
}

function quarterOf(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return "unknown";
  const y = yyyymmdd.slice(0, 4);
  const m = parseInt(yyyymmdd.slice(4, 6), 10);
  const q = Math.ceil(m / 3);
  return `${y}Q${q}`;
}

export const insiderSignalTool = defineTool({
  name: "insider_signal",
  description:
    "임원·주요주주 거래(DS004 elestock)를 매수·매도 클러스터로 집계. " +
    "기간 내 순증감·매수자수·분기별 클러스터 여부 산출. " +
    "버핏 철학의 '경영진 본인 돈으로 매수' 시그널을 LLM 해석 가능한 단위로 제공.",
  input: Input,
  handler: async (ctx, args) => {
    const record = resolveCorp(ctx.resolver, args.corp);
    const startYmd = args.start ? normalizeDate(args.start) : null;
    const endYmd = args.end ? normalizeDate(args.end) : null;

    const raw = await ctx.client.getJson<DartListResp>("elestock.json", {
      corp_code: record.corp_code,
    });
    if (raw.status !== "000" && raw.status !== "013") {
      throw new Error(`DART elestock 오류 [${raw.status}]: ${raw.message}`);
    }
    const all = raw.list ?? [];

    // 기간 필터 (YYYY-MM-DD / YYYYMMDD 모두 수용)
    const filtered = all
      .map((it) => ({ it, ymd: normalizeRcept(it.rcept_dt) }))
      .filter(({ ymd }) => {
        if (!ymd) return false;
        if (startYmd && ymd < startYmd) return false;
        if (endYmd && ymd > endYmd) return false;
        return true;
      })
      .map(({ it, ymd }) => ({ ...it, rcept_dt: ymd as string }));

    // 집계
    let buyCount = 0; // 매수(증가) 건수
    let sellCount = 0; // 매도(감소) 건수
    let netChange = 0; // 순증감 수량
    const buyers = new Set<string>();
    const sellers = new Set<string>();
    const byQuarter: Record<
      string,
      {
        buyers: Set<string>;
        sellers: Set<string>;
        netChange: number;
        reporters: Array<{ name: string; change: number; role: string }>;
      }
    > = {};

    for (const item of filtered) {
      const delta = toInt(item.sp_stock_lmp_irds_cnt);
      if (delta === 0) continue;
      const name = item.repror ?? "(unknown)";
      const role =
        item.isu_exctv_ofcps ||
        item.isu_main_shrholdr ||
        (item.isu_exctv_rgist_at === "Y" ? "등기임원" : "관계자");
      const q = quarterOf(item.rcept_dt ?? "");
      byQuarter[q] ??= {
        buyers: new Set(),
        sellers: new Set(),
        netChange: 0,
        reporters: [],
      };
      byQuarter[q].netChange += delta;
      byQuarter[q].reporters.push({ name, change: delta, role });
      netChange += delta;
      if (delta > 0) {
        buyCount++;
        buyers.add(name);
        byQuarter[q].buyers.add(name);
      } else {
        sellCount++;
        sellers.add(name);
        byQuarter[q].sellers.add(name);
      }
    }

    const clusters = Object.entries(byQuarter)
      .map(([quarter, agg]) => {
        const buyers_n = agg.buyers.size;
        const sellers_n = agg.sellers.size;
        const direction =
          buyers_n >= args.cluster_threshold && buyers_n > sellers_n
            ? "buy_cluster"
            : sellers_n >= args.cluster_threshold && sellers_n > buyers_n
              ? "sell_cluster"
              : "mixed_or_thin";
        // reporters 는 |change| 큰 순 상위 N 만 (대형사 폭발 방지)
        const sortedReporters = [...agg.reporters].sort(
          (a, b) => Math.abs(b.change) - Math.abs(a.change),
        );
        const topReporters = sortedReporters.slice(0, args.reporters_topn);
        return {
          quarter,
          buyers: buyers_n,
          sellers: sellers_n,
          net_change: agg.netChange,
          cluster: direction,
          reporters_total: agg.reporters.length,
          reporters_truncated: agg.reporters.length > args.reporters_topn,
          reporters: topReporters,
        };
      })
      .sort((a, b) => b.quarter.localeCompare(a.quarter));

    const strongestCluster =
      clusters.find((c) => c.cluster === "buy_cluster") ??
      clusters.find((c) => c.cluster === "sell_cluster") ??
      null;

    return {
      resolved: record,
      period: { start: startYmd, end: endYmd },
      cluster_threshold: args.cluster_threshold,
      summary: {
        reports_total: filtered.length,
        buy_events: buyCount,
        sell_events: sellCount,
        unique_buyers: buyers.size,
        unique_sellers: sellers.size,
        net_change_shares: netChange,
        signal:
          buyers.size >= args.cluster_threshold && buyers.size > sellers.size * 2
            ? "strong_buy_cluster"
            : sellers.size >= args.cluster_threshold && sellers.size > buyers.size * 2
              ? "strong_sell_cluster"
              : "neutral_or_mixed",
        strongest_quarter: strongestCluster?.quarter ?? null,
      },
      quarterly_clusters: clusters,
      note: "DART 는 변동사유(장내매수/증여/유상증자 등)를 구분하지 않음. 순수 자발적 매수/매도 해석 시 raw items 의 report_tp·chg_rsn 참조 권장.",
    };
  },
});
