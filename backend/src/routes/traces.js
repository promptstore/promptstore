import { default as dayjs } from 'dayjs';

export default ({ app, auth, logger, services }) => {

  const { tracesService } = services;

  app.get('/api/workspaces/:workspaceId/traces', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const traces = await tracesService.getTraces(workspaceId, 100);
    res.json(traces);
  });

  const getModel = (trace) => {
    if (trace) {
      if (trace.type === 'call-model') {
        return trace.model;
      }
      const children = trace.children || [];
      for (const child of children) {
        const model = getModel(child);
        if (model) {
          return model;
        }
      }
    }
    return null;
  }

  app.get('/api/workspaces/:workspaceId/trace-analytics', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const traces = await tracesService.getTraces(workspaceId, 10000);
    const requestsByUser = traces.reduce((a, t) => {
      // TODO vision model calls may not be recording `createdBy`
      if (t.createdBy) {
        const date = dayjs(t.created).format('YYYY-MM-DD');
        if (!a[date]) {
          a[date] = {};
        }
        if (!a[date][t.createdBy]) {
          a[date][t.createdBy] = {};
        }
        const model = getModel(t.trace?.[0]) || 'undefined';
        if (!a[date][t.createdBy][model]) {
          a[date][t.createdBy][model] = {
            requests: 0,
            tokens: 0,
          };
        }
        a[date][t.createdBy][model].requests += 1;
        a[date][t.createdBy][model].tokens += t.trace?.[0]?.response?.usage?.total_tokens;
      }
      return a;
    }, {});
    res.json({
      requestsByUser,
    });
  });

  app.get('/api/traces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    let trace;
    if (id === 'latest') {
      trace = await tracesService.getLatestTrace();
    } else {
      trace = await tracesService.getTrace(id);
    }
    // logger.debug('trace:', trace);
    res.json(trace);
  });

  app.post('/api/traces', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const trace = await tracesService.upsertTrace(values, username);
    res.json(trace);
  });

  app.put('/api/traces/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const trace = await tracesService.upsertTrace({ ...values, id }, username);
    res.json(trace);
  });

  app.delete('/api/traces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await tracesService.deleteTraces([id]);
    res.json(id);
  });

  app.delete('/api/traces', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',').map(id => +id);
    await tracesService.deleteTraces(ids);
    res.json(ids);
  });

};
