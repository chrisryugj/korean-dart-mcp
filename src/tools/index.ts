/**
 * DART MCP 도구 레지스트리 — 15개
 *
 * v0.7.0 통폐합:
 *   - get_financials 가 get_full_financials 흡수 (scope: summary/full)
 *   - buffett_quality_snapshot 가 quality_compare 흡수 (corps 배열)
 *   - search_disclosures 가 list_recent_filings 흡수 (preset + 페이지 병렬화)
 */

import type { ToolCtx, ToolDef } from "./_helpers.js";

import { resolveCorpCodeTool } from "./resolve-corp-code.js";
import { searchDisclosuresTool } from "./search-disclosures.js";
import { getCompanyTool } from "./get-company.js";
import { getFinancialsTool } from "./get-financials.js";
import { downloadDocumentTool } from "./download-document.js";
import { getXbrlTool } from "./get-xbrl.js";
import { getPeriodicReportTool } from "./get-periodic-report.js";
import { getShareholdersTool } from "./get-shareholders.js";
import { getExecutiveCompensationTool } from "./get-executive-compensation.js";
import { getMajorHoldingsTool } from "./get-major-holdings.js";
import { getCorporateEventTool } from "./get-corporate-event.js";
import { insiderSignalTool } from "./insider-signal.js";
import { disclosureAnomalyTool } from "./disclosure-anomaly.js";
import { buffettQualitySnapshotTool } from "./buffett-quality-snapshot.js";
import { getAttachmentsTool } from "./get-attachments.js";
// + 커버리지 확장 (DS006 증권신고서 / DS003 재무지표 / 범용 패스스루)
import { getSecuritiesFilingTool } from "./get-securities-filing.js";
import { getFinancialIndicatorsTool } from "./get-financial-indicators.js";
import { dartRawTool } from "./dart-raw.js";

export type ToolContext = ToolCtx;
export type ToolDefinition = ToolDef;

/**
 * 15개 도구.
 *
 *  기본 조회 (7):
 *   [x]  1. resolve_corp_code
 *   [x]  2. search_disclosures            (preset + all_pages 병렬 통합)
 *   [x]  3. get_company
 *   [x]  4. get_financials                (scope: summary/full 통합)
 *   [x]  5. download_document             (format: markdown/raw/text)
 *   [x]  6. get_xbrl
 *   [x]  7. get_periodic_report           (29 섹션 enum)
 *
 *  합성 래퍼 (4):
 *   [x]  8. get_shareholders
 *   [x]  9. get_executive_compensation
 *   [x] 10. get_major_holdings
 *   [x] 11. get_corporate_event           (36 enum + timeline mode)
 *
 *  애널리스트 프레임 (3 · 킬러):
 *   [x] 12. insider_signal
 *   [x] 13. disclosure_anomaly
 *   [x] 14. buffett_quality_snapshot      (corps 배열 → 1개=snapshot / 2+=compare)
 *
 *  원문 분석 (1):
 *   [x] 15. get_attachments               (kordoc + ZIP 재귀)
 */
export const TOOL_REGISTRY: ToolDef[] = [
  resolveCorpCodeTool,
  searchDisclosuresTool,
  getCompanyTool,
  getFinancialsTool,
  downloadDocumentTool,
  getXbrlTool,
  getPeriodicReportTool,
  getShareholdersTool,
  getExecutiveCompensationTool,
  getMajorHoldingsTool,
  getCorporateEventTool,
  insiderSignalTool,
  disclosureAnomalyTool,
  buffettQualitySnapshotTool,
  getAttachmentsTool,
  // 커버리지 확장 (+3)
  getSecuritiesFilingTool,
  getFinancialIndicatorsTool,
  dartRawTool,
];
