#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server/mcp-server.js";
import { SERVER_NAME, VERSION } from "./version.js";

async function main() {
  const args = process.argv.slice(2);

  // setup 서브커맨드: npx korean-dart-mcp setup
  if (args[0] === "setup") {
    const { runSetup } = await import("./setup.js");
    try {
      await runSetup();
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ERR_USE_AFTER_CLOSE") return;
      throw err;
    }
    return;
  }

  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    console.error(
      `[${SERVER_NAME}] DART_API_KEY 가 설정되지 않았습니다.\n` +
        `발급: https://opendart.fss.or.kr/ (가입 → 인증키 신청)\n` +
        `쉽게 설치: npx -y korean-dart-mcp setup`,
    );
    process.exit(1);
  }

  const server = createServer({ apiKey });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] v${VERSION} stdio 서버 시작`);
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] fatal:`, err);
  process.exit(1);
});
