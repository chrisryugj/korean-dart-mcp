#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server/mcp-server.js";
import { SERVER_NAME, VERSION } from "./version.js";

async function main() {
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    console.error(
      `[${SERVER_NAME}] DART_API_KEY 가 설정되지 않았습니다.\n` +
        `발급: https://opendart.fss.or.kr/ (가입 → 인증키 신청)`,
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
