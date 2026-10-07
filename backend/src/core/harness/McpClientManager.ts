import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** An MCP server definition as stored by McpServersService. */
export interface McpServer {
  id: number;
  workspaceId: number;
  name: string;
  description?: string;
  /** 'http' = Streamable HTTP (current spec); 'sse' = legacy HTTP+SSE; 'stdio' = local process. */
  transport: 'http' | 'sse' | 'stdio';
  url?: string;
  /** Header values may reference workspace secrets as {SECRET_NAME}. */
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  /** Env values may reference workspace secrets as {SECRET_NAME}. */
  env?: Record<string, string>;
  timeoutMs?: number;
  enabled?: boolean;
  modified?: string | Date;
}

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, any>;
  annotations?: Record<string, any>;
}

export interface McpCallResult {
  content: any[];
  structuredContent?: any;
  isError?: boolean;
}

interface Connection {
  client: Client;
  version: string;
  tools?: McpTool[];
  toolsFetchedAt?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const TOOLS_TTL_MS = 5 * 60_000;
const CLIENT_INFO = { name: 'promptstore-harness', version: '1.0.0' };

/**
 * Pooled MCP client connections, one per server. A connection is replaced
 * when the server definition changes (its `modified` timestamp), and dropped
 * when the transport closes. Tool lists are cached for a few minutes.
 *
 * Local `stdio` servers spawn processes on the backend host, so they are only
 * allowed when MCP_ALLOW_STDIO=true.
 */
export function McpClientManager({ logger, secretsService }: { logger: any; secretsService?: any }) {

  const connections = new Map<number, Connection>();
  const connecting = new Map<number, Promise<Connection>>();

  const versionOf = (server: McpServer) => String(server.modified ? new Date(server.modified).getTime() : 0);

  async function interpolate(workspaceId: number, values?: Record<string, string>) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(values || {})) {
      out[k] = secretsService && typeof v === 'string'
        ? await secretsService.interpolateSecrets(workspaceId, v)
        : String(v);
    }
    return out;
  }

  async function createTransport(server: McpServer) {
    switch (server.transport) {
      case 'http':
      case 'sse': {
        if (!server.url) throw new Error(`MCP server "${server.name}" has no URL`);
        const headers = await interpolate(server.workspaceId, server.headers);
        const url = new URL(server.url);
        if (server.transport === 'sse') {
          return new SSEClientTransport(url, {
            requestInit: { headers },
            eventSourceInit: {
              // the EventSource GET needs the same auth headers
              fetch: (input: any, init: any) => fetch(input, { ...init, headers: { ...init?.headers, ...headers } }),
            } as any,
          });
        }
        return new StreamableHTTPClientTransport(url, { requestInit: { headers } });
      }
      case 'stdio': {
        if (process.env.MCP_ALLOW_STDIO !== 'true') {
          throw new Error('stdio MCP servers are disabled on this server (set MCP_ALLOW_STDIO=true to allow)');
        }
        if (!server.command) throw new Error(`MCP server "${server.name}" has no command`);
        const env = await interpolate(server.workspaceId, server.env);
        return new StdioClientTransport({
          command: server.command,
          args: server.args || [],
          // a minimal environment plus the server's own variables
          env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '', ...env },
          stderr: 'pipe',
        });
      }
      default:
        throw new Error(`Unsupported MCP transport: ${(server as any).transport}`);
    }
  }

  async function connect(server: McpServer): Promise<Connection> {
    const version = versionOf(server);
    const existing = connections.get(server.id);
    if (existing && existing.version === version) return existing;
    if (existing) await close(server.id);

    const pending = connecting.get(server.id);
    if (pending) return pending;

    const promise = (async () => {
      const client = new Client(CLIENT_INFO, { capabilities: {} });
      const transport = await createTransport(server);
      client.onclose = () => {
        if (connections.get(server.id)?.client === client) connections.delete(server.id);
      };
      client.onerror = (err) => {
        // aborts come from closing the connection ourselves (edit, delete, shutdown)
        if (err?.name === 'AbortError' || /AbortError|operation was aborted/.test(String(err?.message))) return;
        logger.warn(`MCP server "${server.name}" error:`, err?.message || err);
      };
      await client.connect(transport, { timeout: server.timeoutMs || DEFAULT_TIMEOUT_MS });
      const conn: Connection = { client, version };
      connections.set(server.id, conn);
      logger.info(`MCP: connected to "${server.name}" (${server.transport})`);
      return conn;
    })();
    connecting.set(server.id, promise);
    try {
      return await promise;
    } finally {
      connecting.delete(server.id);
    }
  }

  /** Run `fn` with a connection, reconnecting once if the connection went away. */
  async function withClient<T>(server: McpServer, fn: (conn: Connection) => Promise<T>): Promise<T> {
    if (server.enabled === false) {
      throw new Error(`MCP server "${server.name}" is disabled`);
    }
    const conn = await connect(server);
    try {
      return await fn(conn);
    } catch (err) {
      if (!isConnectionError(err)) throw err;
      logger.warn(`MCP: reconnecting to "${server.name}":`, err.message);
      await close(server.id);
      return fn(await connect(server));
    }
  }

  async function listTools(server: McpServer, { refresh = false } = {}): Promise<McpTool[]> {
    return withClient(server, async (conn) => {
      if (!refresh && conn.tools && Date.now() - (conn.toolsFetchedAt || 0) < TOOLS_TTL_MS) {
        return conn.tools;
      }
      const tools: McpTool[] = [];
      let cursor: string | undefined;
      do {
        const res = await conn.client.listTools(cursor ? { cursor } : undefined, {
          timeout: server.timeoutMs || DEFAULT_TIMEOUT_MS,
        });
        tools.push(...(res.tools as McpTool[]));
        cursor = res.nextCursor;
      } while (cursor);
      conn.tools = tools;
      conn.toolsFetchedAt = Date.now();
      return tools;
    });
  }

  async function callTool(
    server: McpServer,
    name: string,
    args: Record<string, any>,
    { signal, timeoutMs }: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<McpCallResult> {
    return withClient(server, async (conn) => {
      const res = await conn.client.callTool({ name, arguments: args }, undefined, {
        signal,
        timeout: timeoutMs || server.timeoutMs || DEFAULT_TIMEOUT_MS,
        resetTimeoutOnProgress: true,
      });
      // pre-2025 servers may answer with { toolResult }
      if (!('content' in res) && 'toolResult' in res) {
        return { content: [{ type: 'text', text: JSON.stringify((res as any).toolResult) }] };
      }
      return res as McpCallResult;
    });
  }

  async function close(serverId: number) {
    const conn = connections.get(serverId);
    connections.delete(serverId);
    if (conn) {
      try {
        await conn.client.close();
      } catch (err) {
        // already closed
      }
    }
  }

  async function closeAll() {
    await Promise.all([...connections.keys()].map(close));
  }

  return { listTools, callTool, close, closeAll };
}

export type McpClientManagerService = ReturnType<typeof McpClientManager>;

function isConnectionError(err: any) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('not connected') || msg.includes('connection closed') ||
    msg.includes('econnreset') || msg.includes('socket hang up') || err?.code === -32000;
}
