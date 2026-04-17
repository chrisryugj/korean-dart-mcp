/**
 * DART MCP 도구 레지스트리
 *
 * 83개 OpenDART 엔드포인트 → 15개 도구로 압축.
 * enum 파라미터(report_type, event_type)로 정기보고서·주요사항보고서 묶음 표현.
 * 킬러 3종(insider_signal, disclosure_anomaly, buffett_quality_snapshot)은 raw 테이블을
 * LLM 이 바로 해석 가능한 분석 프레임으로 가공해 제공.
 */

import type { ToolCtx, ToolDef } from "./_helpers.js";

import { resolveCorpCodeTool } from "./resolve-corp-code.js";
import { searchDisclosuresTool } from "./search-disclosures.js";
import { getCompanyTool } from "./get-company.js";
import { getFinancialsTool } from "./get-financials.js";
import { getFullFinancialsTool } from "./get-full-financials.js";
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
import { listRecentFilingsTool } from "./list-recent-filings.js";
import { qualityCompareTool } from "./quality-compare.js";

export type ToolContext = ToolCtx;
export type ToolDefinition = ToolDef;

/**
 * 15개 도구 구현 진행 상황.
 *
 *  [x]  1. resolve_corp_code              [P0]
 *  [x]  2. search_disclosures             [P0]
 *  [x]  3. get_company                    [P0]
 *  [x]  4. get_financials                 [P0]
 *  [x]  5. download_document              [P1]
 *  [x]  6. get_full_financials            [P1]
 *  [x]  7. get_xbrl                       [P1]
 *  [x]  8. get_periodic_report            [P1]  (29개 섹션 enum)
 *  [x]  9. get_shareholders               [P2]  (4섹션 합성)
 *  [x] 10. get_executive_compensation     [P2]  (6섹션 합성)
 *  [x] 11. get_major_holdings             [P2]  (DS004 2엔드포인트)
 *  [x] 12. get_corporate_event            [P2]  (36 enum + timeline)
 *  [x] 13. insider_signal                 [KILLER] 임원 매수·매도 클러스터
 *  [x] 14. disclosure_anomaly             [KILLER] 회계·거버넌스 이상 스코어
 *  [x] 15. buffett_quality_snapshot       [KILLER] N년 퀄리티 체크리스트
 *  [x] 16. get_attachments                [v0.4.0] HWP/PDF 첨부 → 마크다운 (kordoc)
 *  [x] 17. list_recent_filings            [v0.6.0] 공시 프리셋 배치 조회
 *  [x] 18. quality_compare                [v0.6.0] N개 기업 퀄리티 비교 + 랭킹
 */
export const TOOL_REGISTRY: ToolDef[] = [
  resolveCorpCodeTool,
  searchDisclosuresTool,
  getCompanyTool,
  getFinancialsTool,
  getFullFinancialsTool,
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
  listRecentFilingsTool,
  qualityCompareTool,
];
