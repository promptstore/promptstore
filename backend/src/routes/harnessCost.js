// Harness cost & usage: rollup endpoints for the cost dashboard, and budget
// management. All workspace-scoped and behind `auth` (JWT / full key) — these
// are read/config surfaces, not the write-only telemetry ingestion path.

export default ({ app, auth, logger, services }) => {

  const { spanStore, budgetsService, insightsService } = services;

  // default window: last 30 days
  function windowFrom(req) {
    const to = req.query.to || new Date().toISOString();
    const from = req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  }

  // spend / tokens over time, stacked by groupBy (model | provider | user)
  app.get('/api/workspaces/:workspaceId/harness/cost/summary', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const { from, to } = windowFrom(req);
    const bucket = req.query.bucket === 'hour' ? 'hour' : 'day';
    const groupBy = req.query.groupBy || 'model';
    const rows = await spanStore.costRollup(workspaceId, { from, to, bucket, groupBy });
    res.json({ from, to, bucket, groupBy, data: rows });
  });

  // KPI totals + prior-period totals for deltas
  app.get('/api/workspaces/:workspaceId/harness/cost/kpis', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const { from, to } = windowFrom(req);
    res.json(await spanStore.costKpis(workspaceId, { from, to }));
  });

  // provider → model cost distribution (sunburst)
  app.get('/api/workspaces/:workspaceId/harness/cost/distribution', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const { from, to } = windowFrom(req);
    res.json({ from, to, data: await spanStore.costDistribution(workspaceId, { from, to }) });
  });

  // tuning insights (ranked, deep-linkable cards + diagnostic chart data)
  app.get('/api/workspaces/:workspaceId/harness/insights', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const { from, to } = windowFrom(req);
    res.json(await insightsService.getInsights(workspaceId, { from, to }));
  });

  // ---- budgets ----
  app.get('/api/workspaces/:workspaceId/harness/budgets', auth, async (req, res) => {
    res.json(await budgetsService.listBudgets(+req.params.workspaceId));
  });

  app.get('/api/workspaces/:workspaceId/harness/budgets/status', auth, async (req, res) => {
    res.json(await budgetsService.getStatus(+req.params.workspaceId));
  });

  app.put('/api/workspaces/:workspaceId/harness/budgets', auth, async (req, res) => {
    const workspaceId = +req.params.workspaceId;
    const budget = await budgetsService.upsertBudget({ ...req.body, workspaceId }, req.user?.username);
    res.json(budget);
  });

  app.delete('/api/workspaces/:workspaceId/harness/budgets/:id', auth, async (req, res) => {
    await budgetsService.deleteBudget(+req.params.workspaceId, +req.params.id);
    res.json(+req.params.id);
  });

};
