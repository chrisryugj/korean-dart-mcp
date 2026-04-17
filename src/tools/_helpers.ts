/**
 * 툴 공용 유틸
 *  - defineTool: zod 스키마를 JSON Schema 로 자동 변환하며 핸들러에 파싱된 입력을 전달
 *  - resolveCorp: 회사명·종목코드·corp_code 중 무엇이 와도 단일 CorpRecord 로 해석
 *  - normalizeDate: YYYY-MM-DD / YYYYMMDD / YYYY.MM.DD → YYYYMMDD
 */

import { z } from "zod";
import type { CorpCodeResolver, CorpRecord } from "../lib/corp-code.js";
import type { DartClient } from "../lib/dart-client.js";

export interface ToolCtx {
  client: DartClient;
  resolver: CorpCodeResolver;
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown, ctx: ToolCtx) => Promise<unknown>;
}

export function defineTool<S extends z.ZodType>(spec: {
  name: string;
  description: string;
  input: S;
  handler: (ctx: ToolCtx, args: z.infer<S>) => Promise<unknown>;
}): ToolDef {
  return {
    name: spec.name,
    description: spec.description,
    // io:"input" → default() 가 있는 필드는 required 에서 제외되어 LLM 가 빈 인자로도 호출 가능
    inputSchema: z.toJSONSchema(spec.input, { io: "input" }) as Record<string, unknown>,
    handler: async (args, ctx) => {
      const parsed = spec.input.parse(args ?? {});
      return spec.handler(ctx, parsed);
    },
  };
}

export function resolveCorp(resolver: CorpCodeResolver, input: string): CorpRecord {
  const record = resolver.resolve(input);
  if (!record) {
    throw new Error(
      `회사를 찾을 수 없습니다: "${input}". ` +
        `resolve_corp_code 로 먼저 정확한 이름을 확인하세요.`,
    );
  }
  return record;
}

/** OpenDART 는 YYYYMMDD 포맷만 허용. */
export function normalizeDate(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) {
    throw new Error(`날짜 형식 오류: "${input}" (YYYY-MM-DD 또는 YYYYMMDD)`);
  }
  return digits;
}
