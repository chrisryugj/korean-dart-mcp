import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DartClient } from "../lib/dart-client.js";
import { CorpCodeResolver } from "../lib/corp-code.js";
import { TOOL_REGISTRY, type ToolContext } from "../tools/index.js";
import { SERVER_NAME, VERSION } from "../version.js";

export interface ServerOptions {
  apiKey: string;
  cacheDir?: string;
  forceRefresh?: boolean;
}

export function createServer(opts: ServerOptions): Server {
  const client = new DartClient({ apiKey: opts.apiKey });
  const resolver = new CorpCodeResolver({
    cacheDir: opts.cacheDir,
    forceRefresh: opts.forceRefresh,
  });
  const ctx: ToolContext = { client, resolver };

  // corp_code 덤프 선적재: 첫 도구 호출 전에 끝나있어야 함.
  // 실패하면 각 도구가 호출될 때마다 재시도 (init() 은 동일 promise 를 재사용).
  const initReady = resolver.init(client).catch((err) => {
    console.error("[korean-dart-mcp] corp_code 초기화 실패:", err);
    throw err;
  });

  const server = new Server(
    { name: SERVER_NAME, version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_REGISTRY.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOL_REGISTRY.find((t) => t.name === req.params.name);
    if (!tool) {
      throw new Error(`unknown tool: ${req.params.name}`);
    }
    await initReady;
    const result = await tool.handler(req.params.arguments ?? {}, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  return server;
}
