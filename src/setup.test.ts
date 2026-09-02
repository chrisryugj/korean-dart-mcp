import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { windowsClaudeConfigPath } from "./setup.js";

/**
 * 윈도우 Claude Desktop 은 MSIX 패키지라 앱 안에서 본 %APPDATA% 가 패키지 전용 위치로
 * 리다이렉트된다. setup 이 밖에서 보이는 %APPDATA%\Claude 에 써 두면 설치는 성공했다고
 * 나오는데 앱은 그 파일을 읽지 않아 서버가 나타나지 않는다.
 *
 * 실제 경로 선택은 환경변수와 디렉터리 존재 여부로만 갈리므로, 임시 디렉터리로 두 배치를
 * 만들어 어느 쪽을 고르는지 본다(플랫폼 무관).
 */
describe("windowsClaudeConfigPath", () => {
  let root: string;
  let home: string;
  const saved = { appData: process.env["APPDATA"], localAppData: process.env["LOCALAPPDATA"] };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "setup-path-test-"));
    home = join(root, "home");
    process.env["APPDATA"] = join(root, "Roaming");
    process.env["LOCALAPPDATA"] = join(root, "Local");
    mkdirSync(process.env["APPDATA"], { recursive: true });
    mkdirSync(process.env["LOCALAPPDATA"], { recursive: true });
  });

  afterEach(() => {
    if (saved.appData === undefined) delete process.env["APPDATA"];
    else process.env["APPDATA"] = saved.appData;
    if (saved.localAppData === undefined) delete process.env["LOCALAPPDATA"];
    else process.env["LOCALAPPDATA"] = saved.localAppData;
    rmSync(root, { recursive: true, force: true });
  });

  const roamingFallback = () =>
    resolve(process.env["APPDATA"]!, "Claude/claude_desktop_config.json");

  it("MSIX 패키지 폴더가 있으면 앱이 실제로 읽는 경로를 고른다", () => {
    const pkgConfigDir = join(
      process.env["LOCALAPPDATA"]!,
      "Packages",
      "Claude_pzs8sxrjxfjjc",
      "LocalCache",
      "Roaming",
      "Claude",
    );
    mkdirSync(pkgConfigDir, { recursive: true });

    expect(windowsClaudeConfigPath(home)).toBe(
      resolve(pkgConfigDir, "claude_desktop_config.json"),
    );
  });

  it("Packages 폴더 자체가 없으면 %APPDATA% 를 쓴다", () => {
    expect(windowsClaudeConfigPath(home)).toBe(roamingFallback());
  });

  it("Claude 패키지가 없으면 %APPDATA% 를 쓴다", () => {
    mkdirSync(join(process.env["LOCALAPPDATA"]!, "Packages", "SomeOther_abc123"), {
      recursive: true,
    });

    expect(windowsClaudeConfigPath(home)).toBe(roamingFallback());
  });

  it("패키지 폴더는 있지만 설정 디렉터리가 없으면 %APPDATA% 를 쓴다", () => {
    mkdirSync(join(process.env["LOCALAPPDATA"]!, "Packages", "Claude_pzs8sxrjxfjjc"), {
      recursive: true,
    });

    expect(windowsClaudeConfigPath(home)).toBe(roamingFallback());
  });
});
