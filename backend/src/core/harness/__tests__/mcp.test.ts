import http from 'http';
import type { AddressInfo } from 'net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { McpServer as SdkMcpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { MessageRole } from '../../conversions/RosettaStone';
import { HarnessService } from '../HarnessService';
import { McpClientManager } from '../McpClientManager';
import type { McpServer } from '../McpClientManager';
import { fromMcpResult, ToolResolver } from '../ToolResolver';

const logger = { error: () => { }, warn: () => { }, debug: () => { }, info: () => { } };

/** A real Streamable HTTP MCP server (stateless) that requires a bearer token. */
function startServer(): Promise<{ url: string; close: () => Promise<void>; seenAuth: string[] }> {
  const seenAuth: string[] = [];
  const server = http.createServer(async (req, res) => {
    seenAuth.push(String(req.headers.authorization));
    if (req.headers.authorization !== 'Bearer s3cret') {
      res.writeHead(401).end();
      return;
    }
    const mcp = new SdkMcpServer({ name: 'test', version: '1.0.0' });
    mcp.registerTool('add', {
      description: 'Add two numbers',
      inputSchema: { a: z.number(), b: z.number() },
    }, async ({ a, b }) => ({ content: [{ type: 'text', text: String(a + b) }] }));
    mcp.registerTool('fail', {
      description: 'Always fails',
      inputSchema: {},
    }, async () => ({ content: [{ type: 'text', text: 'nope' }], isError: true }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      mcp.close();
    });
    await mcp.connect(transport);
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => transport.handleRequest(req, res, body ? JSON.parse(body) : undefined));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/mcp`,
        seenAuth,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

describe('MCP tools', () => {

  let srv: Awaited<ReturnType<typeof startServer>>;
  let serverDef: McpServer;
  const secretsService = {
    interpolateSecrets: async (_ws: number, v: string) => v.replace('{TOKEN}', 's3cret'),
  };
  const manager = McpClientManager({ logger, secretsService });

  beforeAll(async () => {
    srv = await startServer();
    serverDef = {
      id: 7,
      workspaceId: 1,
      name: 'calc',
      transport: 'http',
      url: srv.url,
      headers: { Authorization: 'Bearer {TOKEN}' },
      modified: new Date('2026-01-01'),
    };
  });

  afterAll(async () => {
    await manager.closeAll();
    await srv.close();
  });

  it('lists and calls tools over Streamable HTTP with secret-interpolated headers', async () => {
    const tools = await manager.listTools(serverDef);
    expect(tools.map((t) => t.name).sort()).toEqual(['add', 'fail']);
    const res = await manager.callTool(serverDef, 'add', { a: 2, b: 3 });
    expect(res.content).toEqual([{ type: 'text', text: '5' }]);
    expect(srv.seenAuth.every((a) => a === 'Bearer s3cret')).toBe(true);
  });

  it('resolves mcp refs to namespaced harness tools and enforces the workspace', async () => {
    const resolver = ToolResolver({
      logger,
      services: {
        mcpClientManager: manager,
        mcpServersService: { getMcpServer: async (id: number) => (id === 7 ? serverDef : null) },
      } as any,
    });
    const all = await resolver.resolveTools([{ type: 'mcp', key: '7' }], { workspaceId: 1 });
    expect(all.map((t) => t.name).sort()).toEqual(['calc__add', 'calc__fail']);
    const one = await resolver.resolveTools([{ type: 'mcp', key: '7/add' }], { workspaceId: 1 });
    expect(one.map((t) => t.name)).toEqual(['calc__add']);
    expect(await resolver.resolveTools([{ type: 'mcp', key: '7' }], { workspaceId: 2 })).toEqual([]);
  });

  it('runs an MCP tool inside a harness loop', async () => {
    const replies = [
      { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'calc__add', arguments: '{"a":20,"b":22}' } }] },
      { content: 'The answer is 42.' },
    ];
    const requests: any[] = [];
    const model: any = {
      modelType: 'gpt',
      async call({ request }: any) {
        requests.push(structuredClone(request));
        const r: any = replies.shift();
        return {
          response: { id: 'x', created: new Date(), model: 'm', n: 1, choices: [{ index: 0, message: { role: 'assistant', content: r.content ?? null, tool_calls: r.tool_calls } }] },
          responseMetadata: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        };
      },
    };
    const svc = HarnessService({
      logger,
      toolResolver: ToolResolver({
        logger,
        services: { mcpClientManager: manager, mcpServersService: { getMcpServer: async () => serverDef } } as any,
      }),
    });
    const { response, responseMetadata } = await svc.run({
      name: 'mcp-test',
      model,
      provider: 'openai',
      modelKey: 'm',
      modelParams: {},
      prompts: [{ role: MessageRole.user, content: 'add 20 and 22' }],
      config: { enabled: true, tools: [{ type: 'mcp', key: '7' }] },
      run: { workspaceId: 1 },
    });
    expect(response.choices[0].message.content).toBe('The answer is 42.');
    expect(responseMetadata.harness.toolCalls).toBe(1);
    expect(requests[1].prompt.messages[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1', content: '42' });
  });

  it('maps MCP results, including errors and structured content', () => {
    expect(fromMcpResult({ content: [{ type: 'text', text: 'x' }], isError: true })).toMatchObject({ isError: true });
    expect(fromMcpResult({ content: [], structuredContent: { a: 1 } }).content).toEqual([{ type: 'text', text: '{"a":1}' }]);
    expect(fromMcpResult({ content: [{ type: 'image', data: 'AAA', mimeType: 'image/png' }] }).content[0]).toEqual({ type: 'image', data: 'AAA', mimeType: 'image/png' });
  });

  it('refuses stdio servers unless MCP_ALLOW_STDIO=true', async () => {
    const stdio: McpServer = { id: 8, workspaceId: 1, name: 'local', transport: 'stdio', command: 'echo' };
    await expect(manager.listTools(stdio)).rejects.toThrow(/MCP_ALLOW_STDIO/);
  });
});
