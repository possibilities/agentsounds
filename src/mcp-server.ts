import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { runPrepared } from "./commands.ts";
import { CONTRACT } from "./contract.ts";
import { fail, UsageError } from "./envelope.ts";
import { SoundsError } from "./errors.ts";
import { agentTools, invocationFor, serverInstructions } from "./mcp-tools.ts";

export function createAgentsoundsMcpServer(): { server: McpServer; drain: () => Promise<void> } {
  const lifetime = new AbortController();
  const active = new Set<Promise<CallToolResult>>();
  const server = new McpServer(
    { name: CONTRACT.meta.name, version: CONTRACT.meta.version },
    { instructions: serverInstructions(CONTRACT) },
  );
  server.server.onclose = () => lifetime.abort();
  for (const tool of agentTools(CONTRACT)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: tool.annotations,
      },
      async (args: unknown, extra): Promise<CallToolResult> => {
        const signal = AbortSignal.any([lifetime.signal, extra.signal]);
        const running = (async (): Promise<CallToolResult> => {
          try {
            const { envelope } = await runPrepared(
              tool.path,
              invocationFor(tool, (args ?? {}) as Record<string, unknown>),
              { signal },
            );
            return {
              structuredContent: { ...envelope },
              content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }],
            };
          } catch (error) {
            if (signal.aborted)
              return { isError: true, content: [{ type: "text", text: "Call cancelled." }] };
            if (error instanceof SoundsError) {
              const envelope = fail(error.code, error.message, error.recovery);
              return {
                isError: true,
                structuredContent: { ...envelope },
                content: [
                  {
                    type: "text",
                    text: `${error.code}: ${error.message}\nrecovery: ${error.recovery}`,
                  },
                  { type: "text", text: JSON.stringify(envelope, null, 2) },
                ],
              };
            }
            const message = error instanceof Error ? error.message : String(error);
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `${error instanceof UsageError ? "invalid call" : "unexpected failure"}: ${message}`,
                },
              ],
            };
          }
        })();
        active.add(running);
        try {
          return await running;
        } finally {
          active.delete(running);
        }
      },
    );
  }
  return {
    server,
    drain: async () => {
      await Promise.allSettled([...active]);
    },
  };
}
