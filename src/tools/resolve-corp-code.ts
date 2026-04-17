/**
 * resolve_corp_code — 회사명·종목코드 → corp_code 조회
 *
 * 모든 DART 엔드포인트는 8자리 corp_code 를 요구하지만, LLM 은 보통 회사명만 안다.
 * 서버가 기동 시 덤프를 SQLite 에 선적재해두므로 LIKE 검색이 수 ms 이내.
 */

import { z } from "zod";
import { defineTool } from "./_helpers.js";

const Input = z.object({
  query: z
    .string()
    .min(1)
    .describe("회사명(한/영), 6자리 종목코드, 또는 8자리 corp_code"),
  limit: z.number().int().min(1).max(50).default(10).describe("최대 반환 개수"),
});

export const resolveCorpCodeTool = defineTool({
  name: "resolve_corp_code",
  description:
    "회사명 또는 종목코드로 OpenDART corp_code 를 조회합니다. " +
    "상장사·정확일치·짧은 이름 순으로 정렬해 반환. " +
    "모든 다른 도구에 회사명을 바로 넘겨도 내부에서 자동 해결되지만, " +
    "결과가 모호할 때 후보를 확인하는 용도로 사용하세요.",
  input: Input,
  handler: async (ctx, args) => {
    const results = ctx.resolver.search(args.query, args.limit);
    return {
      query: args.query,
      count: results.length,
      results,
    };
  },
});
