import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dartXmlToMarkdown } from "./dart-xml.js";

/**
 * 픽스처는 실제 공시(다원컴퓨팅 감사보고서, 접수번호 20260406003197)의 손익계산서
 * 구간을 그대로 발췌한 것이다. 이슈 #3 이 "원문 XML 에 있는 손익계산서 표가 마크다운에서
 * 누락된다"고 보고한 바로 그 문서 구간이라, 변환기가 이 구간을 통째로 흘리면 여기서 잡힌다.
 */
const fixture = readFileSync(
  fileURLToPath(new URL("./__fixtures__/audit-report-excerpt.xml", import.meta.url)),
  "utf8",
);

describe("dartXmlToMarkdown — 재무제표 표 보존 (#3)", () => {
  const md = dartXmlToMarkdown(fixture);

  it("손익계산서 제목과 계정과목이 살아남는다", () => {
    for (const kw of ["손 익 계 산 서", "매출액", "매출원가"]) {
      expect(md).toContain(kw);
    }
  });

  it("금액이 표 셀로 렌더된다", () => {
    expect(md).toContain("52,034,809,530");
    expect(md).toMatch(/^\|.*매출액.*\|$/m);
  });

  it("XML 이 선언하지 않는 HTML 엔티티가 원문 그대로 새지 않는다", () => {
    // DART 마크업은 HTML 계열이라 &nbsp; 로 칸을 맞춘다. XML 파서는 이를 미정의
    // 엔티티로 보고 그대로 두기 때문에, 풀어주지 않으면 표 셀에 원문이 실려 나간다.
    expect(fixture).toContain("&nbsp;");
    expect(md).not.toMatch(/&[a-zA-Z]+;/);
  });
});

/**
 * 위 픽스처는 DART 웹 뷰어의 HTML 이라 download_document 가 실제로 받는 원문과 구조가 다르다.
 * 이 픽스처는 OpenDART document.xml ZIP(같은 공시의 20260406003197_00760.xml)에서 행만 줄여
 * 발췌했다. 원문에서는 감사보고서·재무제표가 <LIBRARY> 로 감싸여 있고 재무제표 본문 셀이
 * <TE> 다. 변환기가 LIBRARY 를 통째로 버리고 TE 를 셀로 치지 않아 재무제표 4종이 사라졌다 (#3).
 */
const apiFixture = readFileSync(
  fileURLToPath(new URL("./__fixtures__/audit-report-opendart-excerpt.xml", import.meta.url)),
  "utf8",
);

describe("dartXmlToMarkdown — OpenDART 원문의 LIBRARY·TE 구조 (#3)", () => {
  const md = dartXmlToMarkdown(apiFixture);

  it("픽스처가 API 원문 구조를 담고 있다", () => {
    // 이 전제가 깨지면 아래 검사는 아무것도 지키지 못한다(뷰어 픽스처가 그랬다).
    expect(apiFixture).toContain("<LIBRARY>");
    expect(apiFixture).toMatch(/<TE\b/);
  });

  it("원문의 TITLE 이 모두 마크다운 제목으로 남는다", () => {
    const titles = [...apiFixture.matchAll(/<TITLE\b[^>]*>([^<]*)<\/TITLE>/g)].map((m) =>
      m[1].replace(/\s+/g, " ").trim(),
    );
    const headings = md
      .split("\n")
      .filter((l) => /^#{1,6} /.test(l))
      .map((l) => l.replace(/^#+ /, ""));
    expect(titles).toContain("손 익 계 산 서");
    expect(headings).toEqual(expect.arrayContaining(titles));
  });

  it("손익계산서 TE 행이 금액과 함께 표 행으로 렌더된다", () => {
    expect(md).toMatch(/^\| 매출액\(주석2\) \|.*52,034,809,530.*32,254,850,607.*\|$/m);
    expect(md).toMatch(/^\| 영업이익 \|.*1,389,584,502.*\|$/m);
  });

  it("병합 머리 칸을 펼쳐 당기·전기 금액이 제 머리 밑에 선다", () => {
    // 머리 행은 과목 | 제10(당)기 COLSPAN=2 | 제9(전)기 COLSPAN=2 → 3칸, 본문 행은 5칸이다.
    // 안 펼치면 뷰어가 넘치는 칸을 버려 당기 금액이 전기 머리 밑에 선다.
    expect(md).toContain("| 과 목 | 제10(당)기 |  | 제9(전)기 |  |\n| --- | --- | --- | --- | --- |");
    expect(md).toContain("| 매출액(주석2) |  | 52,034,809,530 |  | 32,254,850,607 |");
  });

  it("모든 표 행의 칸 수가 머리 구분선과 같다", () => {
    const cells = (l: string) => l.split(/(?<!\\)\|/).length - 2;
    const tables: string[][] = [];
    let inTable = false;
    for (const l of md.split("\n")) {
      const isRow = l.startsWith("|");
      if (isRow && !inTable) tables.push([]);
      if (isRow) tables[tables.length - 1].push(l);
      inTable = isRow;
    }
    expect(tables.length).toBeGreaterThan(1);
    for (const lines of tables) {
      const width = cells(lines[1]);
      for (const l of lines) expect(cells(l), l).toBe(width);
    }
  });

  it("LIBRARY 밖의 주석 표는 종전대로 남는다", () => {
    expect(md).toContain("12. 부가가치계산");
    expect(md).toMatch(/^\| 합 계 \| 6,374,183 \| 5,853,951 \|$/m);
  });
});

describe("dartXmlToMarkdown — 기본 동작", () => {
  it("빈 입력·깨진 입력에 던지지 않는다", () => {
    expect(dartXmlToMarkdown("")).toBe("");
    expect(dartXmlToMarkdown("<DOCUMENT><P>열림만")).toBeTypeOf("string");
  });

  it("표를 마크다운 테이블로 만든다", () => {
    const md = dartXmlToMarkdown(
      "<DOCUMENT><TABLE><TBODY><TR><TD>과목</TD><TD>금액</TD></TR></TBODY></TABLE></DOCUMENT>",
    );
    expect(md).toContain("| 과목 | 금액 |");
    expect(md).toContain("| --- | --- |");
  });

  it("ROWSPAN·COLSPAN 으로 덮인 칸을 빈칸으로 채워 열을 지킨다", () => {
    const md = dartXmlToMarkdown(
      "<DOCUMENT><TABLE><TBODY>" +
        '<TR><TD ROWSPAN="2">구분</TD><TD COLSPAN="2">금액</TD><TD ROWSPAN="2">비고</TD></TR>' +
        "<TR><TD>당기</TD><TD>전기</TD></TR>" +
        "<TR><TD>매출</TD><TD>10</TD><TD>9</TD><TD>-</TD></TR>" +
        "</TBODY></TABLE></DOCUMENT>",
    );
    expect(md).toContain(
      [
        "| 구분 | 금액 |  | 비고 |",
        "| --- | --- | --- | --- |",
        "|  | 당기 | 전기 |  |",
        "| 매출 | 10 | 9 | - |",
      ].join("\n"),
    );
  });
});
