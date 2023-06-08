module.exports = ({ app, logger, passport, services }) => {

  const { chatSessionsService, openaiService } = services;

  app.get('/api/workspaces/:workspaceId/chat-sessions', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { workspaceId } = req.params;
    const chatSessions = await chatSessionsService.getChatSessions(workspaceId);
    res.json(chatSessions);
  });

  app.get('/api/chat-sessions', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const chatSessions = await chatSessionsService.getChatSessions();
    res.json(chatSessions);
  });

  app.get('/api/chat-sessions/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    const session = await chatSessionsService.getChatSession(id);
    res.json(session);
  });

  const getSummary = async (messages) => {
    const content = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
    const msgs = [
      {
        role: 'user',
        content: `Summarize the following content to a maximum of three words: """${content}"""`,
      }
    ];
    const resp = await openaiService.createChatCompletion(msgs, 'gpt-3.5-turbo', 10);
    return resp.choices[0].message.content;
  };

  app.post('/api/chat-sessions', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const values = req.body;
    const name = await getSummary(values.messages);
    const id = await chatSessionsService.upsertChatSession({ ...values, name });
    res.json(id);
  });

  app.put('/api/chat-sessions/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    await chatSessionsService.upsertChatSession({ id, ...values });
    res.json({ status: 'OK' });
  });

  app.delete('/api/chat-sessions/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    await chatSessionsService.deleteChatSessions([id]);
    res.json(id);
  });

  app.delete('/api/chat-sessions', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await chatSessionsService.deleteChatSessions(ids);
    res.json(ids);
  });

};
