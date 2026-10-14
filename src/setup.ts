/**
 * 대화형 설치 마법사 — korean-dart-mcp
 *
 * `npx korean-dart-mcp setup` 으로 실행.
 * OpenDART 인증키를 입력받고, 선택한 AI 클라이언트 설정 파일에 MCP 서버를 자동 등록합니다.
 * Windows / macOS / Linux 공용.
 */

import { createInterface } from "node:readline/promises";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { homedir, platform } from "node:os";
import { stdin, stdout } from "node:process";

interface ClientConfig {
  readonly name: string;
  readonly configPath: string;
  readonly format: "mcpServers" | "servers" | "context_servers";
}

/**
 * 윈도우 Claude Desktop 설정 파일 경로.
 *
 * 윈도우판은 Store 판이든 공식 다운로드판이든 MSIX 패키지라, 앱 안에서 본 %APPDATA% 가
 * 패키지 전용 위치로 리다이렉트된다. 앱이 실제로 읽는 파일은
 * `%LOCALAPPDATA%\Packages\Claude_<publisher>\LocalCache\Roaming\Claude\` 아래에 있고,
 * 밖에서 보이는 `%APPDATA%\Claude\` 가 아니다. 그쪽에 써 두면 설치는 성공했다고 나오는데
 * 앱에는 서버가 나타나지 않는다.
 *
 * 패키지 폴더가 있으면 그것을 쓰고, 없으면(MSIX 가 아닌 설치본) 기존 경로를 그대로 쓴다.
 */
export function windowsClaudeConfigPath(home: string = homedir()): string {
  const roaming = process.env["APPDATA"] ?? resolve(home, "AppData/Roaming");
  const fallback = resolve(roaming, "Claude/claude_desktop_config.json");

  const localAppData = process.env["LOCALAPPDATA"] ?? resolve(home, "AppData/Local");
  const packagesDir = resolve(localAppData, "Packages");
  if (!existsSync(packagesDir)) return fallback;

  let names: string[];
  try {
    names = readdirSync(packagesDir);
  } catch {
    return fallback;
  }

  // 퍼블리셔 해시는 설치본마다 다를 수 있어 이름으로 못 박지 않고 접두사로 찾는다.
  const roots = names
    .filter((n) => n.startsWith("Claude_"))
    .sort()
    .map((n) => resolve(packagesDir, n, "LocalCache/Roaming"));
  if (roots.length === 0) return fallback;

  const configPath = (root: string): string => resolve(root, "Claude/claude_desktop_config.json");

  // 1) 앱이 이미 설정 디렉터리를 만들어 둔 후보가 가장 확실하다.
  const withConfigDir = roots.find((r) => existsSync(resolve(r, "Claude")));
  if (withConfigDir) return configPath(withConfigDir);

  // 2) 설정은 아직 없어도 앱이 한 번이라도 돈 후보를 고른다.
  const withRoaming = roots.find((r) => existsSync(r));
  if (withRoaming) return configPath(withRoaming);

  // 3) 최초 설치라 아무것도 없다. 후보가 하나뿐이면 그 자리를 쓴다(쓰기 단계가 디렉터리를 만든다).
  if (roots.length === 1) return configPath(roots[0]);

  // 4) 후보가 여럿인데 어느 것이 현행인지 가릴 근거가 없다 — 기존 경로를 건드리지 않는다.
  return fallback;
}

function detectClients(): readonly ClientConfig[] {
  const home = homedir();
  const os = platform();
  const clients: ClientConfig[] = [];

  const claudePaths: Record<string, string> = {
    darwin: resolve(home, "Library/Application Support/Claude/claude_desktop_config.json"),
    win32: windowsClaudeConfigPath(home),
    linux: resolve(home, ".config/Claude/claude_desktop_config.json"),
  };
  const claudePath = claudePaths[os];
  if (claudePath) {
    clients.push({ name: "Claude Desktop", configPath: claudePath, format: "mcpServers" });
  }

  clients.push({
    name: "Claude Code (현재 디렉토리)",
    configPath: resolve(process.cwd(), ".mcp.json"),
    format: "mcpServers",
  });

  clients.push({
    name: "Cursor",
    configPath: resolve(home, ".cursor/mcp.json"),
    format: "mcpServers",
  });

  clients.push({
    name: "VS Code (현재 디렉토리)",
    configPath: resolve(process.cwd(), ".vscode/mcp.json"),
    format: "servers",
  });

  clients.push({
    name: "Windsurf",
    configPath: resolve(home, ".codeium/windsurf/mcp_config.json"),
    format: "mcpServers",
  });

  clients.push({
    name: "Gemini CLI",
    configPath: resolve(home, ".gemini/settings.json"),
    format: "mcpServers",
  });

  const zedPaths: Record<string, string> = {
    darwin: resolve(home, ".zed/settings.json"),
    linux: resolve(home, ".config/zed/settings.json"),
    win32: resolve(home, ".zed/settings.json"),
  };
  const zedPath = zedPaths[os];
  if (zedPath) {
    clients.push({ name: "Zed", configPath: zedPath, format: "context_servers" });
  }

  clients.push({
    name: "Antigravity",
    configPath: resolve(home, ".gemini/antigravity/mcp_config.json"),
    format: "mcpServers",
  });

  return clients;
}

async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  if (!existsSync(path)) return {};
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function writeJsonFile(path: string, data: Record<string, unknown>): Promise<void> {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Windows 에선 npx → npx.cmd 를 거치며 Claude Desktop 이 .cmd 를 못 찾는 이슈가 있어
 * `cmd /c` 래핑이 필요하다. README 에도 동일 가이드 있음.
 */
function buildServerEntry(apiKey: string): Record<string, unknown> {
  const env: Record<string, string> = {};
  if (apiKey) env.DART_API_KEY = apiKey;

  if (platform() === "win32") {
    return {
      command: "cmd",
      args: ["/c", "npx", "-y", "korean-dart-mcp"],
      env,
    };
  }
  return {
    command: "npx",
    args: ["-y", "korean-dart-mcp"],
    env,
  };
}

function buildZedEntry(apiKey: string): Record<string, unknown> {
  const env: Record<string, string> = {};
  if (apiKey) env.DART_API_KEY = apiKey;
  const base = platform() === "win32"
    ? { path: "cmd", args: ["/c", "npx", "-y", "korean-dart-mcp"], env }
    : { path: "npx", args: ["-y", "korean-dart-mcp"], env };
  return { command: base };
}

// ─── ANSI ─────────────────────────────────────────────────────────────
const ESC = "\x1b[";
const c = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  cyan: `${ESC}36m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  red: `${ESC}31m`,
  white: `${ESC}37m`,
} as const;

function rgb(r: number, g: number, b: number): string {
  return `${ESC}38;2;${r};${g};${b}m`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function typewrite(text: string, delay = 15): Promise<void> {
  for (const ch of text) {
    process.stdout.write(ch);
    await sleep(delay);
  }
  console.log();
}

async function printBanner(): Promise<void> {
  const gradients = [
    rgb(0, 220, 180), rgb(0, 200, 200), rgb(0, 180, 220),
    rgb(30, 150, 240), rgb(60, 120, 250), rgb(100, 100, 255),
  ];
  const logo = [
    "  _  __                            ____             _   ",
    " | |/ /___  _ __ ___  __ _ _ __   |  _ \\  __ _ _ __| |_ ",
    " | ' // _ \\| '__/ _ \\/ _` | '_ \\  | | | |/ _` | '__| __|",
    " | . \\ (_) | | |  __/ (_| | | | | | |_| | (_| | |  | |_ ",
    " |_|\\_\\___/|_|  \\___|\\__,_|_| |_| |____/ \\__,_|_|   \\__|",
  ];
  console.log();
  for (let i = 0; i < logo.length; i++) {
    const color = gradients[i % gradients.length];
    console.log(`${color}${c.bold}${logo[i]}${c.reset}`);
    await sleep(60);
  }
  console.log();
  await typewrite(`${c.dim}  MCP Server  ━━  OpenDART 83개 API → 15개 도구${c.reset}`, 12);
  console.log();
  console.log(`${c.cyan}  ${"━".repeat(52)}${c.reset}`);
  console.log();
}

function stepHeader(step: number, total: number, title: string): void {
  const dots = `${c.dim}${"·".repeat(Math.max(0, 40 - title.length))}${c.reset}`;
  console.log(`  ${c.cyan}${c.bold}[${step}/${total}]${c.reset} ${c.white}${c.bold}${title}${c.reset} ${dots}`);
  console.log();
}

function successLine(label: string, detail: string): void {
  console.log(`  ${c.green}${c.bold}+${c.reset} ${c.white}${label}${c.reset}${c.dim} ${detail}${c.reset}`);
}

function failLine(label: string, detail: string): void {
  console.log(`  ${c.red}${c.bold}x${c.reset} ${c.white}${label}${c.reset}${c.dim} ${detail}${c.reset}`);
}

async function printComplete(apiKey: string): Promise<void> {
  console.log();
  const box = [
    `  ${c.green}${c.bold}╔${"═".repeat(50)}╗${c.reset}`,
    `  ${c.green}${c.bold}║${c.reset}${" ".repeat(14)}${c.green}${c.bold}Setup Complete!${c.reset}${" ".repeat(22)}${c.green}${c.bold}║${c.reset}`,
    `  ${c.green}${c.bold}╚${"═".repeat(50)}╝${c.reset}`,
  ];
  for (const line of box) {
    console.log(line);
    await sleep(40);
  }
  console.log();
  if (!apiKey) {
    console.log(`  ${c.yellow}!${c.reset} API 키 미설정 — 환경변수 ${c.bold}DART_API_KEY${c.reset} 또는 설정 파일의 ${c.bold}env.DART_API_KEY${c.reset} 수정`);
    console.log();
  }
  console.log(`  ${c.dim}클라이언트를 재시작하면 'korean-dart' MCP 서버가 활성화됩니다.${c.reset}`);
  console.log();
}

export async function runSetup(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    await printBanner();

    stepHeader(1, 3, "OpenDART 인증키");
    console.log(`  ${c.dim}발급: https://opendart.fss.or.kr/ (가입 → 인증키 신청, 무료/일 20,000건)${c.reset}`);
    console.log(`  ${c.dim}Enter로 건너뛰기 — 나중에 환경변수로 설정 가능${c.reset}`);
    console.log();
    const apiKey = (await rl.question(`  ${c.cyan}>${c.reset} API 키: `)).trim();
    if (apiKey) {
      console.log(`  ${c.green}+${c.reset} 키 등록됨`);
    } else {
      console.log(`  ${c.yellow}-${c.reset} 건너뜀`);
    }
    console.log();

    stepHeader(2, 3, "MCP 클라이언트 선택");
    const clients = detectClients();
    clients.forEach((cl, i) => {
      const exists = existsSync(cl.configPath);
      const badge = exists ? `${c.green} [감지됨]${c.reset}` : "";
      const num = `${c.cyan}${String(i + 1).padStart(2)}${c.reset}`;
      console.log(`  ${num}) ${c.white}${cl.name}${c.reset}${badge}`);
    });
    console.log();
    const clientInput = (await rl.question(`  ${c.cyan}>${c.reset} 번호 (예: 1,3): `)).trim();

    if (!clientInput) {
      console.log(`\n  ${c.yellow}선택 없음${c.reset} — 수동 설정 안내:`);
      printManualConfig(apiKey);
      return;
    }

    const indices = clientInput
      .split(",")
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((i) => i >= 0 && i < clients.length);

    if (indices.length === 0) {
      console.log(`\n  ${c.yellow}유효한 선택 없음${c.reset} — 수동 설정 안내:`);
      printManualConfig(apiKey);
      return;
    }

    console.log();
    stepHeader(3, 3, "설정 파일 업데이트");
    const entry = buildServerEntry(apiKey);

    for (const idx of indices) {
      const client = clients[idx];
      await sleep(150);
      try {
        const config = await readJsonFile(client.configPath);
        const key = client.format;
        const serverEntry = key === "context_servers" ? buildZedEntry(apiKey) : entry;
        const servers = (config[key] ?? {}) as Record<string, unknown>;
        servers["korean-dart"] = serverEntry;
        config[key] = servers;
        await writeJsonFile(client.configPath, config);
        successLine(client.name, client.configPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failLine(client.name, msg);
      }
    }

    await printComplete(apiKey);
  } finally {
    rl.close();
  }
}

function printManualConfig(apiKey: string): void {
  const entry = buildServerEntry(apiKey);
  console.log();
  console.log(`  ${c.dim}아래 JSON을 설정 파일의 mcpServers에 추가하세요:${c.reset}`);
  console.log();
  console.log(`  ${c.cyan}"korean-dart"${c.reset}: ${JSON.stringify(entry, null, 4)}`);
  console.log();
}
