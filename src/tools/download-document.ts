/**
 * download_document — 공시 원문 XML (document.xml) + 마크다운 변환
 *
 * ZIP 으로 반환되는 DART 원문(DART 전용 XML 마크업) 을 해제하여 반환.
 * format:
 *   - "markdown" (기본) → 자체 DART XML 파서로 깔끔한 마크다운 (heading/테이블 보존)
 *   - "raw"              → 원본 XML 문자열
 *   - "text"             → 태그 제거한 plain text (테이블 구조 사라짐)
 *
 * 파일이 크면 변환 후 `truncate_at` 으로 절단 (기본 100k chars).
 *
 * 참고: https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019003
 */

import { z } from "zod";
import iconv from "iconv-lite";
import { defineTool } from "./_helpers.js";
import { dartXmlToMarkdown } from "../lib/dart-xml.js";
import { safeUnzipToMemory } from "../utils/safe-zip.js";

const Input = z.object({
  rcept_no: z
    .string()
    .regex(/^\d{14}$/)
    .describe("접수번호 14자리 (search_disclosures 의 rcept_no)"),
  format: z
    .enum(["markdown", "raw", "text"])
    .default("markdown")
    .describe("출력 포맷. markdown=DART XML → 마크다운, raw=원본 XML, text=태그 제거"),
  truncate_at: z
    .number()
    .int()
    .min(1000)
    .default(100_000)
    .describe("텍스트 최대 길이 (초과분은 잘림)"),
});

export const downloadDocumentTool = defineTool({
  name: "download_document",
  description:
    "공시서류 원문을 마크다운/원본XML/plain text 로 반환합니다. 기본값 markdown — DART 전용 XML 을 자체 파서로 heading·테이블 보존해 변환. " +
    "대형 사업보고서는 수백 KB 이상이라 기본 10만 자에서 절단. " +
    "사업보고서·반기보고서·주요사항보고 등 모든 공시 원문에 사용.",
  input: Input,
  handler: async (_ctx, args) => {
    const buf = await _ctx.client.getZip("document.xml", {
      rcept_no: args.rcept_no,
    });
    const files = await extractZipEntries(buf);
    // DART 는 첨부문서를 **별도 XML 엔트리**로 넣는다(감사보고서 + 재무제표 등).
    // 첫 엔트리만 변환하면 나머지가 조용히 사라진다 — 사용자에겐 "원문에 있는 표가
    // 마크다운에서 누락"으로 보인다 (#3). 모든 XML 엔트리를 파일명 머리글과 함께 잇는다.
    const xmlFiles = files.filter((f) => /\.xml$/i.test(f.name));
    if (!xmlFiles.length) {
      throw new Error(
        `원문 XML 을 찾지 못했습니다. 반환된 파일: ${files.map((f) => f.name).join(", ")}`,
      );
    }
    // DART 원문은 EUC-KR 로 인코딩된 경우가 많음 → XML 선언에서 인코딩 감지
    const docs = xmlFiles.map((f) => ({ name: f.name, xml: decodeXml(f.data) }));

    const render = (xml: string): string => {
      if (args.format === "raw") return xml;
      if (args.format === "text") {
        return xml
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
      return dartXmlToMarkdown(xml);
    };

    // 엔트리가 하나뿐인 흔한 경우엔 머리글을 붙이지 않는다 (기존 출력 그대로).
    const content =
      docs.length === 1
        ? render(docs[0].xml)
        : docs.map((d) => `<!-- ${d.name} -->\n${render(d.xml)}`).join("\n\n");

    const rawCharCount = docs.reduce((n, d) => n + d.xml.length, 0);
    const truncated = content.length > args.truncate_at;
    return {
      rcept_no: args.rcept_no,
      file: xmlFiles[0].name,
      files: xmlFiles.map((f) => f.name),
      format: args.format,
      size_bytes: xmlFiles.reduce((n, f) => n + f.data.length, 0),
      raw_char_count: rawCharCount,
      char_count: content.length,
      truncated,
      content: truncated ? content.slice(0, args.truncate_at) : content,
    };
  },
});

type ZipFile = { name: string; data: Buffer };

function extractZipEntries(buf: Buffer): Promise<ZipFile[]> {
  return safeUnzipToMemory(buf);
}

function decodeXml(buf: Buffer): string {
  // XML 선언의 encoding 속성 확인 (첫 200바이트만)
  const head = buf.subarray(0, Math.min(200, buf.length)).toString("ascii");
  const m = /encoding\s*=\s*["']([^"']+)["']/i.exec(head);
  const enc = (m?.[1] ?? "utf-8").toLowerCase();
  if (enc === "utf-8" || enc === "utf8") return buf.toString("utf8");
  return iconv.decode(buf, enc);
}
