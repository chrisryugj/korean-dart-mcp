/**
 * get_attachments — 공시 첨부파일 목록 조회 + HWP/PDF → 마크다운 추출
 *
 * OpenDART API 는 첨부파일 직접 엔드포인트가 없다. DART 뷰어 HTML 을 스크래핑해야 한다.
 * OpenDartReader 도 동일 패턴. 사실상 업계 표준.
 *
 *   1. 뷰어 HTML  `/dsaf001/main.do?rcpNo=...`  →  JS 변수 `node1['dcmNo']` 추출
 *   2. 다운로드 페이지  `/pdf/download/main.do?rcp_no=&dcm_no=`  →  `<td class="tL">` 파싱
 *   3. 각 첨부 URL (`/pdf/download/pdf.do?...` 등) fetch → Buffer
 *   4. kordoc.parse() 로 HWP/HWPX/PDF/DOCX/XLSX → 마크다운
 *
 * mode="list" — 첨부 목록만 반환 (가볍고 빠름, 파일명·download_url·format 힌트)
 * mode="extract" — 지정한 파일을 다운로드·파싱해 마크다운 반환
 */

import { z } from "zod";
import { parse as kordocParse } from "kordoc";
import { defineTool } from "./_helpers.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const DART_ORIGIN = "http://dart.fss.or.kr";

const Input = z
  .object({
    rcept_no: z
      .string()
      .regex(/^\d{14}$/)
      .describe("접수번호 14자리"),
    mode: z
      .enum(["list", "extract"])
      .default("list")
      .describe("list: 첨부 목록만. extract: 파일 하나 다운·파싱해 마크다운"),
    filename: z
      .string()
      .optional()
      .describe("extract 모드에서 정확한 파일명 (부분일치 폴백 없음)"),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("extract 모드에서 0-based index (filename 우선)"),
    truncate_at: z
      .number()
      .int()
      .min(1000)
      .default(100_000)
      .describe("extract 마크다운 최대 길이"),
  })
  .refine(
    (v) => v.mode !== "extract" || v.filename !== undefined || v.index !== undefined,
    { message: "extract 모드엔 filename 또는 index 중 하나 필수" },
  );

interface Attachment {
  index: number;
  filename: string;
  download_url: string;
  format: string;
}

const EXT_FORMAT: Array<[RegExp, string]> = [
  [/\.hwpx$/i, "hwpx"],
  [/\.hwp$/i, "hwp"],
  [/\.pdf$/i, "pdf"],
  [/\.docx$/i, "docx"],
  [/\.doc$/i, "doc"],
  [/\.xlsx$/i, "xlsx"],
  [/\.xls$/i, "xls"],
  [/\.zip$/i, "zip"],
  [/\.html?$/i, "html"],
];

function detectFormat(filename: string): string {
  for (const [re, fmt] of EXT_FORMAT) {
    if (re.test(filename)) return fmt;
  }
  return "unknown";
}

/** 뷰어 HTML 에서 첫 번째 `node[12]['dcmNo']` 추출. 단일-페이지 viewDoc() 도 폴백. */
function extractDcmNo(html: string, rcptNo: string): string | null {
  const nodeRe = new RegExp(
    `node[12]\\['rcpNo'\\]\\s*=\\s*"${rcptNo}";\\s*node[12]\\['dcmNo'\\]\\s*=\\s*"(\\d+)"`,
  );
  const nodeMatch = nodeRe.exec(html);
  if (nodeMatch) return nodeMatch[1];

  const singleRe = /viewDoc\('(\d+)',\s*'(\d+)'/;
  const s = singleRe.exec(html);
  return s?.[2] ?? null;
}

/** 다운로드 페이지 HTML 에서 첨부 테이블 행 추출. 주석 블록은 먼저 제거. */
function parseAttachmentTable(html: string): Array<{ filename: string; href: string }> {
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, "");
  const rowRe =
    /<td class="tL">\s*([^<]+?)\s*<\/td>\s*<td>\s*<a class="btnFile"\s+href="([^"]+)"/g;
  const rows: Array<{ filename: string; href: string }> = [];
  for (const m of cleaned.matchAll(rowRe)) {
    rows.push({ filename: m[1].trim(), href: m[2] });
  }
  return rows;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`DART viewer fetch 실패: ${url} → HTTP ${res.status}`);
  return await res.text();
}

async function fetchBinary(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`DART 첨부 다운로드 실패: ${url} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function listAttachments(rcept_no: string): Promise<{
  dcm_no: string;
  viewer_url: string;
  download_page_url: string;
  attachments: Attachment[];
}> {
  const viewerUrl = `${DART_ORIGIN}/dsaf001/main.do?rcpNo=${rcept_no}`;
  const viewerHtml = await fetchHtml(viewerUrl);
  const dcm_no = extractDcmNo(viewerHtml, rcept_no);
  if (!dcm_no) {
    throw new Error(
      `뷰어에서 dcm_no 추출 실패. 비공개 문서이거나 구조가 바뀌었을 수 있음: ${viewerUrl}`,
    );
  }
  const dlPageUrl = `${DART_ORIGIN}/pdf/download/main.do?rcp_no=${rcept_no}&dcm_no=${dcm_no}`;
  const dlHtml = await fetchHtml(dlPageUrl);
  const rows = parseAttachmentTable(dlHtml);
  const attachments: Attachment[] = rows.map((r, i) => ({
    index: i,
    filename: r.filename,
    download_url: r.href.startsWith("http") ? r.href : `${DART_ORIGIN}${r.href}`,
    format: detectFormat(r.filename),
  }));
  return { dcm_no, viewer_url: viewerUrl, download_page_url: dlPageUrl, attachments };
}

export const getAttachmentsTool = defineTool({
  name: "get_attachments",
  description:
    "공시 첨부파일(HWP/PDF/DOCX/XLSX)을 목록 조회(mode=list) 하거나 다운받아 마크다운으로 추출(mode=extract). " +
    "DART 뷰어 HTML 스크래핑 기반 — OpenDART 표준 API 에 첨부 엔드포인트가 없어 공식 뷰어를 통해 접근. " +
    "extract 모드는 kordoc 엔진으로 HWP/HWPX/PDF/DOCX/XLSX → 마크다운 변환.",
  input: Input,
  handler: async (_ctx, args) => {
    const info = await listAttachments(args.rcept_no);

    if (args.mode === "list") {
      return {
        rcept_no: args.rcept_no,
        dcm_no: info.dcm_no,
        viewer_url: info.viewer_url,
        download_page_url: info.download_page_url,
        count: info.attachments.length,
        attachments: info.attachments,
      };
    }

    // extract 모드
    let target: Attachment | undefined;
    if (args.filename) {
      target = info.attachments.find((a) => a.filename === args.filename);
      if (!target) {
        throw new Error(
          `파일명 일치 없음: "${args.filename}". 사용 가능: ${info.attachments
            .map((a) => a.filename)
            .join(" / ")}`,
        );
      }
    } else if (args.index !== undefined) {
      target = info.attachments[args.index];
      if (!target) {
        throw new Error(
          `index 범위 초과: ${args.index} (총 ${info.attachments.length}개)`,
        );
      }
    }
    if (!target) {
      throw new Error("extract 모드엔 filename 또는 index 필수");
    }

    if (target.format === "zip" || target.format === "unknown") {
      return {
        rcept_no: args.rcept_no,
        filename: target.filename,
        format: target.format,
        download_url: target.download_url,
        supported: false,
        note:
          target.format === "zip"
            ? "XBRL 등 ZIP 첨부는 get_xbrl 또는 download_document 로 처리. kordoc 파싱 미지원."
            : "확장자로 포맷 판별 실패. download_url 로 직접 받아 확인.",
      };
    }

    const buf = await fetchBinary(target.download_url);
    // kordoc 내부에서 ArrayBuffer 를 detach 할 수 있어 파싱 전에 크기 캡처
    const sizeBytes = buf.length;
    const parsed = await kordocParse(buf);
    if (!parsed.success) {
      return {
        rcept_no: args.rcept_no,
        filename: target.filename,
        format: target.format,
        download_url: target.download_url,
        size_bytes: sizeBytes,
        supported: false,
        error: parsed.error,
        error_code: parsed.code,
      };
    }

    const md = parsed.markdown ?? "";
    const truncated = md.length > args.truncate_at;

    return {
      rcept_no: args.rcept_no,
      filename: target.filename,
      format: target.format,
      file_type_detected: parsed.fileType,
      download_url: target.download_url,
      size_bytes: sizeBytes,
      char_count: md.length,
      truncated,
      markdown: truncated ? md.slice(0, args.truncate_at) : md,
      warnings: parsed.warnings ?? [],
      outline: parsed.outline ?? null,
      metadata: parsed.metadata ?? null,
    };
  },
});
