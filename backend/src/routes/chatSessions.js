module.exports = ({ app, auth, logger, services }) => {

  const { chatSessionsService, executionsService } = services;

  app.get('/api/workspaces/:workspaceId/chat-sessions', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const chatSessions = await chatSessionsService.getChatSessions(workspaceId);
    res.json(chatSessions);
  });

  app.get('/api/chat-sessions', auth, async (req, res, next) => {
    const chatSessions = await chatSessionsService.getChatSessions();
    res.json(chatSessions);
  });

  app.get('/api/chat-sessions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const session = await chatSessionsService.getChatSession(id);
    res.json(session);
  });

  app.post('/api/chat-sessions', auth, async (req, res, next) => {
    const values = req.body;
    const content = values.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n\n');
    const args = { content };
    const resp = await executionsService.executeFunction('create_summary_label', args, {});
    const name = resp.choices[0].message.content;
    const id = await chatSessionsService.upsertChatSession({ ...values, name });
    res.json(id);
  });

  app.put('/api/chat-sessions/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await chatSessionsService.upsertChatSession({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/chat-sessions/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await chatSessionsService.deleteChatSessions([id]);
    res.json(id);
  });

  app.delete('/api/chat-sessions', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await chatSessionsService.deleteChatSessions(ids);
    res.json(ids);
  });

};
