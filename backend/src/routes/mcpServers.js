export default ({ app, auth, constants, logger, services }) => {

  const { mcpClientManager, mcpServersService } = services;

  const TRANSPORTS = ['http', 'sse', 'stdio'];

  const validate = (values) => {
    if (!values?.name?.trim()) return 'name is required';
    if (!/^[a-zA-Z0-9_-]+$/.test(values.name)) {
      return 'name may contain only letters, numbers, "_" and "-" (it prefixes tool names)';
    }
    if (!TRANSPORTS.includes(values.transport)) {
      return `transport must be one of ${TRANSPORTS.join(', ')}`;
    }
    if (values.transport === 'stdio') {
      if (!values.command) return 'command is required for stdio servers';
    } else {
      try {
        const url = new URL(values.url);
        if (!['http:', 'https:'].includes(url.protocol)) return 'url must be http(s)';
      } catch (err) {
        return 'a valid url is required';
      }
    }
    return null;
  };

  /**
   * @openapi
   * components:
   *   schemas:
   *     McpServerInput:
   *       type: object
   *       required:
   *         - name
   *         - transport
   *         - workspaceId
   *       properties:
   *         name:
   *           type: string
   *           description: Unique per workspace. Prefixes the server's tool names (`<name>__<tool>`).
   *         description:
   *           type: string
   *         transport:
   *           type: string
   *           enum: [http, sse, stdio]
   *           description: "`http` = Streamable HTTP, `sse` = legacy HTTP+SSE, `stdio` = local process (requires MCP_ALLOW_STDIO=true)."
   *         url:
   *           type: string
   *         headers:
   *           type: object
   *           description: HTTP headers. Values may reference workspace secrets as {SECRET_NAME}.
   *         command:
   *           type: string
   *         args:
   *           type: array
   *           items:
   *             type: string
   *         env:
   *           type: object
   *           description: Environment for stdio servers. Values may reference workspace secrets as {SECRET_NAME}.
   *         timeoutMs:
   *           type: integer
   *         enabled:
   *           type: boolean
   *         workspaceId:
   *           type: integer
   */

  /**
   * @openapi
   * /api/workspaces/{workspaceId}/mcp-servers:
   *   get:
   *     description: List the MCP servers in a workspace.
   *     tags: [MCP Servers]
   */
  app.get('/api/workspaces/:workspaceId/mcp-servers', auth, async (req, res) => {
    const servers = await mcpServersService.getMcpServers(+req.params.workspaceId);
    res.json(servers);
  });

  /**
   * @openapi
   * /api/mcp-servers/{id}:
   *   get:
   *     description: Get an MCP server.
   *     tags: [MCP Servers]
   */
  app.get('/api/mcp-servers/:id', auth, async (req, res) => {
    const server = await mcpServersService.getMcpServer(+req.params.id);
    if (!server) return res.sendStatus(404);
    res.json(server);
  });

  /**
   * @openapi
   * /api/mcp-servers/{id}/tools:
   *   get:
   *     description: Connect to an MCP server and list its tools. `?refresh=true` bypasses the cache.
   *     tags: [MCP Servers]
   */
  app.get('/api/mcp-servers/:id/tools', auth, async (req, res) => {
    const server = await mcpServersService.getMcpServer(+req.params.id);
    if (!server) return res.sendStatus(404);
    try {
      const tools = await mcpClientManager.listTools(server, { refresh: req.query.refresh === 'true' });
      res.json(tools.map(({ name, title, description, inputSchema, annotations }) => ({
        name, title, description, inputSchema, annotations,
      })));
    } catch (err) {
      logger.warn(`MCP: listing tools for "${server.name}" failed:`, err.message);
      res.status(502).json({ errors: [{ message: err.message }] });
    }
  });

  /**
   * @openapi
   * /api/mcp-servers:
   *   post:
   *     description: Create an MCP server.
   *     tags: [MCP Servers]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/McpServerInput'
   */
  app.post('/api/mcp-servers', auth, async (req, res) => {
    const { username } = req.user;
    const values = req.body;
    const error = validate(values);
    if (error) return res.status(400).json({ errors: [{ message: error }] });
    try {
      const server = await mcpServersService.upsertMcpServer({ ...values, id: undefined }, username);
      res.json(server);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ errors: [{ message: `An MCP server named "${values.name}" already exists` }] });
      }
      throw err;
    }
  });

  /**
   * @openapi
   * /api/mcp-servers/{id}:
   *   put:
   *     description: Update an MCP server. Open connections are replaced.
   *     tags: [MCP Servers]
   */
  app.put('/api/mcp-servers/:id', auth, async (req, res) => {
    const { username } = req.user;
    const id = +req.params.id;
    const saved = await mcpServersService.getMcpServer(id);
    if (!saved) return res.sendStatus(404);
    const values = { ...saved, ...req.body, id, workspaceId: saved.workspaceId };
    const error = validate(values);
    if (error) return res.status(400).json({ errors: [{ message: error }] });
    const server = await mcpServersService.upsertMcpServer(values, username);
    await mcpClientManager.close(id);
    res.json(server);
  });

  /**
   * @openapi
   * /api/mcp-servers/{id}:
   *   delete:
   *     description: Delete an MCP server.
   *     tags: [MCP Servers]
   */
  app.delete('/api/mcp-servers/:id', auth, async (req, res) => {
    const id = +req.params.id;
    await mcpServersService.deleteMcpServers([id]);
    await mcpClientManager.close(id);
    res.json(id);
  });

  /**
   * @openapi
   * /api/mcp-servers:
   *   delete:
   *     description: Delete MCP servers by `?ids=1,2`.
   *     tags: [MCP Servers]
   */
  app.delete('/api/mcp-servers', auth, async (req, res) => {
    const ids = String(req.query.ids || '').split(',').filter(Boolean).map(Number);
    await mcpServersService.deleteMcpServers(ids);
    await Promise.all(ids.map((id) => mcpClientManager.close(id)));
    res.json(ids);
  });

};
