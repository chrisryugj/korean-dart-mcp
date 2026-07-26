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
});
