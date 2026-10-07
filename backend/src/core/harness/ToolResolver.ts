import { PARA_DELIM, convertContentTypeToString } from '../conversions/RosettaStone';
import type { HarnessTool, ImageContent, TextContent, ToolResult } from '../../lib/harness';
import type { McpCallResult, McpClientManagerService, McpServer } from './McpClientManager';
import type { HarnessRunOptions, HarnessToolRef } from './types';

/**
 * Resolves harness tool references to executable HarnessTools. This is the
 * dispatch the legacy agents implement inline in `_callFunction`: plugin
 * tools, semantic functions, compositions, sub-agents and index search.
 */
export interface ToolResolverDeps {
  logger: any;
  services: {
    agentsService: any;
    compositionsService: any;
    executionsService: any;
    functionsService: any;
    indexesService: any;
    llmService: any;
    mcpClientManager?: McpClientManagerService;
    mcpServersService?: any;
    toolService: any;
    vectorStoreService: any;
  };
}

const TOOL_NAME_RE = /[^a-zA-Z0-9_-]/g;

/** Provider tool names must match ^[a-zA-Z0-9_-]{1,64}$. */
export function toToolName(name: string) {
  return (name || 'tool').replace(TOOL_NAME_RE, '_').slice(0, 64);
}

function text(value: any): ToolResult {
  let str: string;
  if (value == null) {
    str = '';
  } else if (typeof value === 'string') {
    str = value;
  } else {
    try {
      str = JSON.stringify(value);
    } catch (err) {
      str = String(value);
    }
  }
  return { content: [{ type: 'text', text: str }], details: {} };
}

function throwOnErrors(res: any) {
  if (res?.errors?.length) {
    throw new Error(res.errors.map((e: any) => e.message || String(e)).join('; '));
  }
}

export function ToolResolver({ logger, services }: ToolResolverDeps) {

  const {
    agentsService,
    compositionsService,
    executionsService,
    functionsService,
    indexesService,
    llmService,
    mcpClientManager,
    mcpServersService,
    toolService,
    vectorStoreService,
  } = services;

  async function resolveTools(refs: HarnessToolRef[] = [], run: HarnessRunOptions = {}): Promise<HarnessTool[]> {
    const tools: HarnessTool[] = [];
    for (const ref of refs) {
      try {
        tools.push(...await resolveTool(ref, run));
      } catch (err) {
        logger.error(`Harness: could not resolve tool ${ref.type}:${ref.key}:`, err.message);
      }
    }
    // keep the first of any duplicate names
    const seen = new Set<string>();
    return tools.filter((t) => {
      if (seen.has(t.name)) return false;
      seen.add(t.name);
      return true;
    });
  }

  async function resolveTool(ref: HarnessToolRef, run: HarnessRunOptions): Promise<HarnessTool[]> {
    switch (ref.type) {
      case 'tool':
        return pluginTools(ref.key);
      case 'function':
        return [await functionTool(ref.key, run)];
      case 'composition':
        return [await compositionTool(ref.key, run)];
      case 'agent':
        return [await agentTool(ref.key, run)];
      case 'index':
        return [indexTool(ref.key)];
      case 'mcp':
        return mcpTools(ref.key, run);
      default:
        throw new Error(`Unknown tool type: ${(ref as any).type}`);
    }
  }

  function pluginTools(key: string): HarnessTool[] {
    const [toolKey, instance] = key.split('__');
    const plugin = toolService.getTool(toolKey);
    if (!plugin) {
      throw new Error(`Tool not found: ${key}`);
    }
    let metas: any[];
    if (plugin.multitool) {
      const all = plugin.getOpenAPIMetadata();
      metas = instance ? all.filter((m: any) => m.name === key) : all;
    } else {
      metas = [plugin.getOpenAPIMetadata()];
    }
    return metas.map((meta) => {
      // multitool entries are called by their own name; simple tools by key
      const callKey = plugin.multitool ? meta.name : key;
      return {
        name: toToolName(meta.name),
        label: meta.name,
        description: meta.description || plugin.__description || meta.name,
        parameters: meta.parameters || { type: 'object', properties: {} },
        execute: async (_id, args) => text(await toolService.call(callKey, args, false)),
      } as HarnessTool;
    });
  }

  async function functionTool(id: string, run: HarnessRunOptions): Promise<HarnessTool> {
    const func = await functionsService.getFunction(id);
    if (!func) throw new Error(`Function not found: ${id}`);
    return {
      name: toToolName(func.name),
      label: func.name,
      description: func.description || func.name,
      parameters: func.arguments || { type: 'object', properties: {} },
      execute: async (_id, args, signal) => {
        const res = await executionsService.executeFunction({
          workspaceId: run.workspaceId,
          username: run.username,
          func,
          args,
          params: { maxTokens: 1024 },
          // nested harness functions share the parent's abort signal and trace
          options: { harness: { workspaceId: run.workspaceId, username: run.username, signal, parentTraceId: run.parentTraceId } },
        });
        throwOnErrors(res);
        const message = res.response?.choices?.[0]?.message;
        if (message?.function_call) {
          return text(message.function_call.arguments);
        }
        return text(convertContentTypeToString(message?.content));
      },
    };
  }

  async function compositionTool(id: string, run: HarnessRunOptions): Promise<HarnessTool> {
    const composition = await compositionsService.getComposition(id);
    if (!composition) throw new Error(`Composition not found: ${id}`);
    const requestNode = composition.flow?.nodes?.find((n: any) => n.type === 'requestNode');
    return {
      name: toToolName(composition.name),
      label: composition.name,
      description: composition.description || composition.name,
      parameters: requestNode?.data?.arguments || { type: 'object', properties: {} },
      executionMode: 'sequential',
      execute: async (_id, args) => {
        const res = await executionsService.executeComposition({
          workspaceId: run.workspaceId,
          username: run.username,
          composition,
          args,
          params: { maxTokens: 1024 },
        });
        throwOnErrors(res);
        return text(res.response?.myargs?.content ?? res.response);
      },
    };
  }

  async function agentTool(id: string, run: HarnessRunOptions): Promise<HarnessTool> {
    const agent = await agentsService.getAgent(id);
    if (!agent) throw new Error(`Agent not found: ${id}`);
    return {
      name: toToolName(agent.name),
      label: agent.name,
      description: agent.description || agent.name,
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The goal that the agent is tasked to achieve.' },
        },
        required: ['goal'],
      },
      execute: async (_id, args) => {
        const res = await executionsService.executeAgent({
          workspaceId: run.workspaceId,
          username: run.username,
          agent,
          args,
          callbacks: [],
        });
        return text(res);
      },
    };
  }

  function indexTool(indexName: string): HarnessTool {
    return {
      name: toToolName(`search_${indexName}`),
      label: `Search ${indexName}`,
      description: `Search the "${indexName}" knowledge index. Input should be a search query.`,
      parameters: {
        type: 'object',
        properties: { input: { type: 'string', description: 'Search query' } },
        required: ['input'],
      },
      execute: async (_id, args) => {
        const index = await indexesService.getIndexByName(indexName);
        if (!index) throw new Error(`Index not found: ${indexName}`);
        const { embeddingProvider, embeddingModel, vectorStoreProvider } = index;
        if (!vectorStoreProvider) {
          throw new Error('Only vector stores currently support search');
        }
        let queryEmbedding: number[];
        if (vectorStoreProvider !== 'redis' && vectorStoreProvider !== 'elasticsearch') {
          const embeddingResponse = await llmService.createEmbedding(embeddingProvider, {
            input: args.input,
            inputType: 'search_query',
            model: embeddingModel,
          });
          queryEmbedding = embeddingResponse.data[0].embedding;
        }
        const searchResponse = await vectorStoreService.search(
          vectorStoreProvider,
          indexName,
          args.input,
          null,
          null,
          { k: 5, queryEmbedding }
        );
        return text(searchResponse.hits.join(PARA_DELIM));
      },
    };
  }

  /** `key` is `<serverId>` for every tool on the server, or `<serverId>/<toolName>`. */
  async function mcpTools(key: string, run: HarnessRunOptions): Promise<HarnessTool[]> {
    if (!mcpClientManager || !mcpServersService) {
      throw new Error('MCP support is not configured');
    }
    const slash = key.indexOf('/');
    const serverId = slash === -1 ? key : key.slice(0, slash);
    const toolName = slash === -1 ? undefined : key.slice(slash + 1);
    const server: McpServer = await mcpServersService.getMcpServer(+serverId);
    if (!server) throw new Error(`MCP server not found: ${serverId}`);
    if (run.workspaceId != null && server.workspaceId !== run.workspaceId) {
      throw new Error(`MCP server ${serverId} belongs to another workspace`);
    }
    const tools = await mcpClientManager.listTools(server);
    const selected = toolName ? tools.filter((t) => t.name === toolName) : tools;
    if (toolName && !selected.length) {
      throw new Error(`Tool "${toolName}" not found on MCP server "${server.name}"`);
    }
    return selected.map((tool) => ({
      // namespaced so tools from different servers cannot collide
      name: toToolName(`${server.name}__${tool.name}`),
      label: `${server.name}: ${tool.title || tool.annotations?.title || tool.name}`,
      description: tool.description || tool.name,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
      // a server that says its tool changes state should not race itself
      executionMode: tool.annotations?.readOnlyHint === false ? 'sequential' : undefined,
      execute: async (_id, args, signal) => fromMcpResult(
        await mcpClientManager.callTool(server, tool.name, args, { signal })
      ),
    } as HarnessTool));
  }

  return { resolveTools };
}

/** MCP CallToolResult -> harness ToolResult. */
export function fromMcpResult(res: McpCallResult): ToolResult {
  const content: (TextContent | ImageContent)[] = [];
  for (const c of res.content || []) {
    if (c.type === 'text') {
      content.push({ type: 'text', text: c.text });
    } else if (c.type === 'image') {
      content.push({ type: 'image', data: c.data, mimeType: c.mimeType });
    } else if (c.type === 'resource') {
      const r = c.resource || {};
      content.push({ type: 'text', text: r.text ?? `[resource ${r.uri}${r.mimeType ? ` (${r.mimeType})` : ''}]` });
    } else if (c.type === 'resource_link') {
      content.push({ type: 'text', text: `[resource ${c.uri}${c.name ? ` "${c.name}"` : ''}]` });
    } else if (c.type === 'audio') {
      content.push({ type: 'text', text: `[audio ${c.mimeType || ''}]` });
    }
  }
  if (!content.length && res.structuredContent !== undefined) {
    content.push({ type: 'text', text: JSON.stringify(res.structuredContent) });
  }
  return {
    content,
    details: res.structuredContent !== undefined ? { structuredContent: res.structuredContent } : {},
    isError: !!res.isError,
  };
}

export type ToolResolverService = ReturnType<typeof ToolResolver>;
