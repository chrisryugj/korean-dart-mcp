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
 *   TE                                    → 표 셀 (재무제표 본문, 계정코드 ACODE 를 단 TD)
 *   P                                     → 단락
 *   PGBRK                                 → 수평선
 *   A                                     → 인라인 텍스트 (href 없음)
 *   IMAGE/IMG                             → 제거
 *   LIBRARY                               → 컨테이너 (감사보고서·재무제표 본문을 감싼다, 자식 그대로 변환)
 *   SUMMARY/EXTRACTION                    → 메타 제거
 *   COLGROUP/COL                          → 제거 (스타일 전용)
 *   나머지 (SPAN, COMPANY-NAME 등)         → 텍스트만 유지
 *
 * 병합 셀(COLSPAN/ROWSPAN) 은 마크다운이 지원하지 않으므로 격자로 펼친다 — 글은 첫 칸, 덮인 칸은 빈칸.
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
  // LIBRARY 는 넣지 말 것 — 감사보고서·재무제표 4종 같은 본문을 감싸는 컨테이너다 (#3).
  "FORMULA-VERSION",
]);

const SECTION_DEPTH: Record<string, number> = {
  "SECTION-1": 2,
  "SECTION-2": 3,
  "SECTION-3": 4,
  "SECTION-4": 5,
};

export function dartXmlToMarkdown(xml: string): string {
  // DART XML 은 일부 엔트리에 한글 태그(`<이사ㆍ감사>`) 가 텍스트가 아닌 마크업으로
  // 들어가 있어 xmldom 의 well-formedness 검사가 ParseError 로 fatal-throw 한다.
  // xmldom errorHandler 옵션은 warning/error 만 silence 가능하고 fatalError 는 throw 됨.
  // → 비-ASCII 로 시작하는 태그는 모두 entity escape 해서 텍스트로 강등시킨다.
  const sanitized = sanitizeNonAsciiTags(decodeHtmlEntities(xml));
  const silentHandler = () => {};
  let doc: any;
  try {
    doc = new DOMParser({ errorHandler: silentHandler }).parseFromString(sanitized, "text/xml") as any;
  } catch {
    // 그래도 실패 시 text/html 모드 (xmldom 이 더 관대)
    try {
      doc = new DOMParser({ errorHandler: silentHandler }).parseFromString(sanitized, "text/html") as any;
    } catch {
      return "";
    }
  }
  const root = doc?.documentElement;
  if (!root) return "";
  return convertNode(root, 1).replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * XML 이 기본 선언하지 않는 HTML 명명 엔티티를 미리 푼다.
 *
 * DART 마크업은 HTML 계열이라 `&nbsp;` 로 칸을 맞춘다(공시 1건에서 332회 관측).
 * XML 파서는 이걸 **정의되지 않은 엔티티**로 보고 그대로 두기 때문에, 손대지 않으면
 * 마크다운 표 셀에 `과&nbsp;&nbsp;목` 같은 원문이 그대로 실려 나간다.
 */
function decodeHtmlEntities(xml: string): string {
  return xml.replace(/&nbsp;/g, " ");
}

/**
 * `<한글태그>...</한글태그>` 같은 비-ASCII 태그를 entity escape 해서 텍스트로 만든다.
 * XML 표준 NameStartChar 는 유니코드를 허용하지만 DART 의 한글 태그는 닫는 태그가
 * 누락된 경우가 있어 well-formedness 가 깨진다.
 */
function sanitizeNonAsciiTags(xml: string): string {
  // 1. CDATA 섹션은 보호 (변환 대상 아님)
  // 2. `<` 다음 첫 문자가 ASCII letter / `?` / `!` / `/` 가 아니면 entity escape
  return xml.replace(/<\/?[^\x00-\x7F][^<>]*>/g, (m) =>
    m.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  );
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
  // 병합 칸(COLSPAN·ROWSPAN)은 격자로 펼친다 — 글은 첫 칸에, 덮인 칸은 빈칸. 안 펼치면 재무제표 머리 행
  // (과목 | 제10(당)기 COLSPAN=2 | 제9(전)기 COLSPAN=2 → 3칸)이 본문 행(5칸)보다 좁아, 뷰어가 넘치는 칸을
  // 버리고 당기 금액이 전기 머리 밑에 선다 (#3).
  const rows: string[][] = [];
  let covered: number[] = []; // 열마다 위 행의 ROWSPAN 이 이 행부터 더 덮는 행 수
  for (const tr of trs) {
    const kids = tr.childNodes;
    if (!kids) continue;
    const cells: any[] = [];
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i];
      // TE: 재무제표 본문 셀(계정코드 ACODE 를 단 TD). 빠지면 TE 만으로 된 행이 통째로 사라진다 (#3).
      if (c.nodeType === 1 && /^(TD|TH|TU|TE)$/i.test(String(c.nodeName))) cells.push(c);
    }
    if (!cells.length) continue;
    const row: string[] = [];
    const next: number[] = [];
    const skipCovered = () => {
      while ((covered[row.length] ?? 0) > 0) {
        next[row.length] = covered[row.length] - 1;
        row.push("");
      }
    };
    for (const c of cells) {
      skipCovered();
      const colSpan = spanOf(c, "COLSPAN");
      const rowSpan = spanOf(c, "ROWSPAN");
      for (let k = 0; k < colSpan; k++) {
        next[row.length] = rowSpan - 1;
        row.push(k === 0 ? escapeCell(inlineText(c)) : "");
      }
    }
    skipCovered();
    // 행 끝 너머에 떨어져 남은 덮인 칸도 이 행 몫을 줄인다(빈칸은 아래에서 너비를 맞추며 채운다).
    for (let col = row.length; col < covered.length; col++) {
      if ((covered[col] ?? 0) > 0) next[col] = covered[col] - 1;
    }
    covered = next;
    rows.push(row);
  }
  if (!rows.length) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) => `| ${[...r, ...Array(width - r.length).fill("")].join(" | ")} |`;
  return [
    `\n${line(rows[0])}`,
    `| ${Array(width).fill("---").join(" | ")} |`,
    ...rows.slice(1).map(line),
  ].join("\n");
}

function spanOf(cell: any, attr: string): number {
  const n = parseInt(cell.getAttribute?.(attr) || cell.getAttribute?.(attr.toLowerCase()) || "1", 10);
  return n > 1 ? n : 1;
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
