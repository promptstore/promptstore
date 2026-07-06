// Per-workspace spend budgets (Phase 4). CRUD over the `budgets` table plus a
// status computation that compares current-period model-call cost (from the
// span store) against each budget's limit and alert thresholds.

export function BudgetsService({ pg, logger, spanStore }) {

  function mapRow(row) {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      period: row.period,
      limitAmount: row.limit_amount != null ? Number(row.limit_amount) : null,
      currency: row.currency,
      alertThresholds: row.alert_thresholds || [],
      scope: row.scope || null,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function listBudgets(workspaceId) {
    const { rows } = await pg.query(
      `SELECT * FROM budgets WHERE workspace_id = $1 ORDER BY created DESC`, [workspaceId]);
    return rows.map(mapRow);
  }

  async function upsertBudget(values, username) {
    const { id, workspaceId, period = 'month', limitAmount, currency = 'USD', alertThresholds = [0.8, 1.0], scope = null } = values;
    const at = JSON.stringify(alertThresholds);
    const sc = scope ? JSON.stringify(scope) : null;
    if (id) {
      const { rows } = await pg.query(`
        UPDATE budgets SET period = $1, limit_amount = $2, currency = $3, alert_thresholds = $4, scope = $5, modified = NOW(), modified_by = $6
        WHERE id = $7 AND workspace_id = $8 RETURNING *
        `, [period, limitAmount, currency, at, sc, username, id, workspaceId]);
      return rows[0] ? mapRow(rows[0]) : null;
    }
    const { rows } = await pg.query(`
      INSERT INTO budgets (workspace_id, period, limit_amount, currency, alert_thresholds, scope, created_by, modified_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *
      `, [workspaceId, period, limitAmount, currency, at, sc, username]);
    return mapRow(rows[0]);
  }

  async function deleteBudget(workspaceId, id) {
    await pg.query(`DELETE FROM budgets WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
    return id;
  }

  // start of the current period (UTC), as an ISO string
  function periodStart(period, now) {
    const d = new Date(now);
    if (period === 'day') {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
    }
    // default: month
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  }

  // Status for every budget: current-period spend vs limit, % used, remaining,
  // and which alert thresholds are breached. `now` is injected for testability.
  async function getStatus(workspaceId, now = Date.now()) {
    const budgets = await listBudgets(workspaceId);
    const nowIso = new Date(now).toISOString();
    return Promise.all(budgets.map(async (b) => {
      const from = periodStart(b.period, now);
      const spend = await spanStore.costInWindow(workspaceId, { from, to: nowIso });
      const used = b.limitAmount ? spend / b.limitAmount : 0;
      const breached = (b.alertThresholds || [])
        .filter(t => used >= t)
        .sort((a, z) => z - a);
      return {
        ...b,
        periodStart: from,
        spend,
        used,                                   // fraction 0..1+
        remaining: b.limitAmount != null ? b.limitAmount - spend : null,
        over: b.limitAmount != null && spend > b.limitAmount,
        breachedThreshold: breached.length ? breached[0] : null,
      };
    }));
  }

  return { listBudgets, upsertBudget, deleteBudget, getStatus, periodStart };
}
