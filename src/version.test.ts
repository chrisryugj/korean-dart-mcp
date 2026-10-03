import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { VERSION } from "./version.js";

/**
 * VERSION 은 MCP `serverInfo.version`, CLI `--version`, 첨부파일 내려받기의 User-Agent 에
 * 함께 쓰인다. package.json 만 올리고 이 상수를 잊으면 배포판이 자기 버전을 틀리게
 * 보고하므로, 릴리스 전에 여기서 걸리게 한다.
 */
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as { version: string };

describe("version", () => {
  it("package.json 의 version 과 일치한다", () => {
    expect(VERSION).toBe(pkg.version);
  });
});
