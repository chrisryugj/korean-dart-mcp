/**
 * DART 원문 XML → 마크다운 변환기
 *
 * DART 전용 마크업(`dart4.xsd`) 은 공개 표준이 아니지만 구조가 단순해서
 * 주요 태그만 대응해도 LLM 이 읽을 수 있는 수준의 마크다운을 만들 수 있다.
 *
 * 지원 태그:
 *   DOCUMENT / BODY                       → 루트
 *   COVER-TITLE / DOCUMENT-NAME           → # 제목
 *   SECTION-1/2/3                         → 하위 TITLE 의 heading level 제어
 *   TITLE                                 → ##/###/#### (상위 SECTION 깊이에 따라)
 *   TABLE, THEAD, TBODY, TR, TH, TD, TU  → 마크다운 테이블
 *   P                                     → 단락
 *   PGBRK                                 → 수평선
 *   A                                     → 인라인 텍스트 (href 없음)
 *   IMAGE/IMG/LIBRARY                     → 제거
 *   SUMMARY/EXTRACTION                    → 메타 제거
 *   COLGROUP/COL                          → 제거 (스타일 전용)
 *   나머지 (SPAN, COMPANY-NAME 등)         → 텍스트만 유지
 *
 * 병합 셀(COLSPAN/ROWSPAN) 은 마크다운 자체가 지원하지 않으므로 무시.
 *
 * 타입 주석: 본 프로젝트 tsconfig 에 DOM lib 이 없어 xmldom 의 Node/Element 전역이 없다.
 *            duck-typing 으로 any 처리.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DOMParser } from "@xmldom/xmldom";

const SKIP_TAGS = new Set([
  "SUMMARY",
  "EXTRACTION",
  "COLGROUP",
  "COL",
  "IMAGE",
  "IMG",
  "IMG-CAPTION",
  "LIBRARY",
  "FORMULA-VERSION",
]);

const SECTION_DEPTH: Record<string, number> = {
  "SECTION-1": 2,
  "SECTION-2": 3,
  "SECTION-3": 4,
  "SECTION-4": 5,
};

export function dartXmlToMarkdown(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "text/xml") as any;
  const root = doc?.documentElement;
  if (!root) return "";
  return convertNode(root, 1).replace(/\n{3,}/g, "\n\n").trim();
}

function convertNode(node: any, titleDepth: number): string {
  if (!node) return "";
  if (node.nodeType === 3) {
    // Text node
    return ((node.nodeValue ?? "") as string).replace(/[ \t]+/g, " ").replace(/\n+/g, " ");
  }
  if (node.nodeType !== 1) return ""; // Element 아니면 스킵 (comment 등)
  const tag = String(node.nodeName ?? "").toUpperCase();

  if (SKIP_TAGS.has(tag)) return "";

  if (tag === "COVER-TITLE" || tag === "DOCUMENT-NAME") {
    const t = inlineText(node);
    return t ? `\n# ${t}\n\n` : "";
  }
  if (tag === "TITLE") {
    const level = Math.min(6, Math.max(2, titleDepth));
    const t = inlineText(node);
    return t ? `\n${"#".repeat(level)} ${t}\n\n` : "";
  }
  if (SECTION_DEPTH[tag] !== undefined) {
    return renderChildren(node, SECTION_DEPTH[tag]);
  }
  if (tag === "P") {
    const t = inlineText(node);
    return t ? `${t}\n\n` : "";
  }
  if (tag === "PGBRK") {
    return "\n---\n\n";
  }
  if (tag === "TABLE") {
    return renderTable(node) + "\n";
  }
  if (tag === "TABLE-GROUP") {
    return renderChildren(node, titleDepth);
  }
  if (tag === "BR") {
    return "\n";
  }

  return renderChildren(node, titleDepth);
}

function renderChildren(el: any, titleDepth: number): string {
  let out = "";
  const children = el.childNodes;
  if (!children) return "";
  for (let i = 0; i < children.length; i++) {
    out += convertNode(children[i], titleDepth);
  }
  return out;
}

function inlineText(el: any): string {
  return String(el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function renderTable(table: any): string {
  const trs = collectByTag(table, "TR");
  if (!trs.length) return "";
  const rowTexts: string[] = [];
  let headerSize = 0;
  for (const tr of trs) {
    const kids = tr.childNodes;
    if (!kids) continue;
    const cells: any[] = [];
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i];
      if (c.nodeType === 1 && /^(TD|TH|TU)$/i.test(String(c.nodeName))) cells.push(c);
    }
    if (!cells.length) continue;
    const row = cells.map((c) => escapeCell(inlineText(c))).join(" | ");
    rowTexts.push(row);
    if (headerSize === 0) headerSize = cells.length;
  }
  if (!rowTexts.length) return "";
  const separator = Array(headerSize).fill("---").join(" | ");
  return [
    `\n| ${rowTexts[0]} |`,
    `| ${separator} |`,
    ...rowTexts.slice(1).map((r) => `| ${r} |`),
  ].join("\n");
}

function collectByTag(parent: any, tag: string): any[] {
  const out: any[] = [];
  const walker = (el: any) => {
    const kids = el.childNodes;
    if (!kids) return;
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i];
      if (c.nodeType === 1) {
        if (String(c.nodeName).toUpperCase() === tag) out.push(c);
        walker(c);
      }
    }
  };
  walker(parent);
  return out;
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
