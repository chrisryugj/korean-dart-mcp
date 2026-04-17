/**
 * list_recent_filings — 업종·이벤트 프리셋으로 최근 공시 배치 조회
 *
 * `search_disclosures` 는 범용이지만 LLM 이 pblntf_ty + report_nm 키워드 조합을
 * 매번 지어내서 실수하기 쉽다. 자주 쓰는 조합을 enum `preset` 으로 굳혀둔다.
 *
 * 동작:
 *   1. 프리셋 → (pblntf_ty, report_nm 정규식) 매핑
 *   2. list.json 을 기간 내 페이지 순회로 전량 수집 (상한 있음)
 *   3. report_nm 정규식 매칭으로 클라이언트 측 필터
 *   4. 정정공시 제외(default) / 포함 선택
 */

import { z } from "zod";
import { defineTool, normalizeDate, resolveCorp } from "./_helpers.js";

interface Preset {
  kind: string | null; // DART pblntf_ty (미지정이면 전체)
  keyword: RegExp | null; // report_nm 정규식 (미지정이면 pass)
  label: string;
}

const PRESETS: Record<string, Preset> = {
  // 자기주식
  treasury_buy: { kind: "B", keyword: /자기주식.*취득/, label: "자기주식 취득 결정" },
  treasury_sell: { kind: "B", keyword: /자기주식.*처분/, label: "자기주식 처분 결정" },
  treasury_trust: { kind: "B", keyword: /자기주식.*신탁/, label: "자기주식 신탁 계약" },

  // 사채 발행
  cb_issue: { kind: "B", keyword: /전환사채/, label: "전환사채(CB) 발행결정" },
  bw_issue: { kind: "B", keyword: /신주인수권부사채/, label: "신주인수권부사채(BW) 발행결정" },
  eb_issue: { kind: "B", keyword: /교환사채/, label: "교환사채(EB) 발행결정" },

  // 자본 증감
  rights_offering: { kind: "B", keyword: /유상증자/, label: "유상증자 결정" },
  bonus_issue: { kind: "B", keyword: /무상증자/, label: "무상증자 결정" },
  capital_reduction: { kind: "B", keyword: /감자/, label: "감자 결정" },

  // 지배구조 변경
  merger: { kind: "B", keyword: /합병/, label: "합병 결정" },
  split: { kind: "B", keyword: /분할/, label: "분할 결정" },
  stock_exchange: { kind: "B", keyword: /주식교환|주식이전/, label: "주식교환·이전 결정" },

  // 양수도
  business_transfer: { kind: "B", keyword: /영업양도/, label: "영업양도" },
  business_acquisition: { kind: "B", keyword: /영업양수/, label: "영업양수" },

  // 지분공시
  large_holding_5pct: { kind: "D", keyword: null, label: "지분공시 전체 (5% 대량보유·임원지분)" },

  // 정기공시
  annual_report: { kind: "A", keyword: /사업보고서/, label: "사업보고서" },
  half_report: { kind: "A", keyword: /반기보고서/, label: "반기보고서" },
  quarterly_report: { kind: "A", keyword: /분기보고서/, label: "분기보고서" },

  // 감사
  audit_report: { kind: "F", keyword: null, label: "외부감사 관련 공시 전체" },

  // 정정
  correction_all: { kind: null, keyword: /\[기재정정\]|\[첨부정정\]|\[첨부추가\]/, label: "정정공시 전체" },

  // 부실
  insolvency: {
    kind: "B",
    keyword: /부도발생|영업정지|회생절차|해산사유|채권은행/,
    label: "부실·법적 리스크 이벤트",
  },

  // 소송
  litigation: { kind: "B", keyword: /소송/, label: "소송 제기" },
};

const PRESET_KEYS = Object.keys(PRESETS) as [string, ...string[]];

const Input = z.object({
  preset: z
    .enum(PRESET_KEYS)
    .describe(
      "프리셋: treasury_buy/sell/trust, cb/bw/eb_issue, rights_offering, bonus_issue, capital_reduction, merger, split, stock_exchange, business_transfer/acquisition, large_holding_5pct, annual_report, half_report, quarterly_report, audit_report, correction_all, insolvency, litigation",
    ),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(7)
    .describe("기준일(오늘) 으로부터 과거 N일 (기본 7일)"),
  corp: z
    .string()
    .optional()
    .describe("특정 회사 필터 (회사명/종목코드/corp_code). 미지정 시 전 상장사"),
  start: z.string().optional().describe("명시 시작일 (days 무시)"),
  end: z.string().optional().describe("명시 종료일 (미지정 시 오늘)"),
  include_corrections: z
    .boolean()
    .default(false)
    .describe("정정공시 포함 여부. 기본 false (원공시만). correction_all 프리셋은 자동 true."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(100)
    .describe("최종 반환 개수 상한"),
});

interface ListItem {
  rcept_no: string;
  corp_cls: string;
  corp_name: string;
  corp_code: string;
  report_nm: string;
  rcept_dt: string;
  flr_nm?: string;
  rm?: string;
  [k: string]: string | undefined;
}

interface DartListResp {
  status: string;
  message: string;
  page_no?: number;
  page_count?: number;
  total_count?: number;
  total_page?: number;
  list?: ListItem[];
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export const listRecentFilingsTool = defineTool({
  name: "list_recent_filings",
  description:
    "자주 쓰는 공시 유형(자기주식 취득, CB 발행, 합병, 정정공시 등 20+개) 을 프리셋으로 빠르게 조회. " +
    "days(기본 7일) 내 전체 또는 특정 회사. search_disclosures 의 고수준 래퍼.",
  input: Input,
  handler: async (ctx, args) => {
    const preset = PRESETS[args.preset];
    const end_de = args.end ? normalizeDate(args.end) : ymd(new Date());
    let bgn_de: string;
    if (args.start) {
      bgn_de = normalizeDate(args.start);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - args.days);
      bgn_de = ymd(d);
    }

    let corp_code: string | undefined;
    let resolved: { corp_code: string; corp_name: string } | undefined;
    if (args.corp) {
      const r = resolveCorp(ctx.resolver, args.corp);
      corp_code = r.corp_code;
      resolved = { corp_code: r.corp_code, corp_name: r.corp_name };
    }

    // 페이지 순회 수집 (DART 기본 page_count=100, max ~100)
    const collected: ListItem[] = [];
    let page_no = 1;
    const MAX_PAGES = 30;
    while (page_no <= MAX_PAGES) {
      const raw = await ctx.client.getJson<DartListResp>("list.json", {
        corp_code,
        bgn_de,
        end_de,
        pblntf_ty: preset.kind ?? undefined,
        page_no,
        page_count: 100,
      });
      if (raw.status !== "000") {
        if (raw.status === "013") break; // 결과 없음
        throw new Error(`DART list 오류 [${raw.status}]: ${raw.message}`);
      }
      collected.push(...(raw.list ?? []));
      if (!raw.total_page || page_no >= raw.total_page) break;
      page_no++;
    }

    const includeCorrections =
      args.include_corrections || args.preset === "correction_all";

    // 필터링
    const filtered = collected.filter((item) => {
      if (!includeCorrections && /\[(기재정정|첨부정정|첨부추가)\]/.test(item.report_nm)) {
        return false;
      }
      if (preset.keyword && !preset.keyword.test(item.report_nm)) return false;
      return true;
    });

    const limited = filtered.slice(0, args.limit);

    return {
      preset: args.preset,
      preset_label: preset.label,
      period: { start: bgn_de, end: end_de, days: args.days },
      corp: resolved ?? null,
      include_corrections: includeCorrections,
      total_fetched: collected.length,
      matched: filtered.length,
      returned: limited.length,
      items: limited.map((it) => ({
        rcept_no: it.rcept_no,
        rcept_dt: it.rcept_dt,
        corp_name: it.corp_name,
        corp_code: it.corp_code,
        corp_cls: it.corp_cls,
        report_nm: it.report_nm,
        flr_nm: it.flr_nm ?? null,
      })),
    };
  },
});
