/**
 * DART MCP 도구 레지스트리
 *
 * 83개 OpenDART 엔드포인트 → 15개 도구로 압축.
 * enum 파라미터(report_type, event_type)로 정기보고서·주요사항보고서 묶음 표현.
 */

import type { ToolCtx, ToolDef } from "./_helpers.js";

import { resolveCorpCodeTool } from "./resolve-corp-code.js";
import { searchDisclosuresTool } from "./search-disclosures.js";
import { getCompanyTool } from "./get-company.js";
import { getFinancialsTool } from "./get-financials.js";

export type ToolContext = ToolCtx;
export type ToolDefinition = ToolDef;

/**
 * 15개 도구 구현 진행 상황.
 *
 *  [x] 1. resolve_corp_code          [P0]
 *  [x] 2. search_disclosures         [P0]
 *  [x] 3. get_company                [P0]
 *  [x] 4. get_financials             [P0]
 *  [ ] 5. download_document          [P1]
 *  [ ] 6. get_full_financials        [P1]
 *  [ ] 7. get_xbrl                   [P1]
 *  [ ] 8. get_periodic_report        [P1]
 *  [ ] 9. get_executive_compensation [P2]
 *  [ ] 10. get_shareholders          [P2]
 *  [ ] 11. get_major_holdings        [P2]
 *  [ ] 12. get_corporate_event       [P2]
 *  [ ] 13. get_securities_filing     [P3]
 *  [ ] 14. list_recent_filings       [P3]
 *  [ ] 15. compare_companies         [P3]
 */
export const TOOL_REGISTRY: ToolDef[] = [
  resolveCorpCodeTool,
  searchDisclosuresTool,
  getCompanyTool,
  getFinancialsTool,
];
