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
  // 실패하면 각 도구 호출 때 init() 이 다시 시도한다. 여기서 다시 던지면 도구 호출 전까지
  // 아무도 받지 않는 거부가 되어 node 가 프로세스를 종료한다(클라이언트엔 "Server disconnected").
  resolver.init(client).catch((err) => {
    console.error("[korean-dart-mcp] corp_code 초기화 실패:", err);
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
    await resolver.init(client);
    const result = await tool.handler(req.params.arguments ?? {}, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  return server;
}
