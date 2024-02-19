import omit from 'lodash.omit';

export function TracesService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      name: row.name,
      workspaceId: row.workspace_id,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getTraces(workspaceId, limit, start, filters, nameQuery, startDate, endDate, success, minLatency, maxLatency) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let filterClauses = '';
    let j = 4;
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (Array.isArray(v)) {
          if (typeof v[0] === 'boolean') {
            filterClauses += `AND (val->>'${k}')::BOOLEAN = ANY($${j}::BOOLEAN[]) `;
          } else {
            filterClauses += `AND val->>'${k}' = ANY($${j}::VARCHAR[]) `;
          }
        } else {
          filterClauses += `AND val->>'${k}' = $${j} `;
        }
        j += 1;
      }
    }
    const values = [workspaceId, limit, start, ...Object.values(filters || {})];
    if (nameQuery) {
      filterClauses += `AND name LIKE $${j}`;
      values.push(`%${nameQuery}%`);
      j += 1;
    }
    if (startDate) {
      filterClauses += `AND created >= $${j} `;
      values.push(startDate);
      j += 1;
    }
    if (endDate) {
      filterClauses += `AND created <= $${j} `;
      values.push(endDate);
      j += 1;
    }
    if (success) {
      filterClauses += `AND (val->'trace'->0->>'success')::BOOLEAN = ANY($${j}) `;
      values.push(success);
      j += 1;
    }
    if (minLatency) {
      filterClauses += `AND (val->'trace'->0->>'elapsedMillis')::INT >= $${j} `;
      values.push(minLatency);
      j += 1;
    }
    if (maxLatency) {
      filterClauses += `AND (val->'trace'->0->>'elapsedMillis')::INT <= $${j} `;
      values.push(maxLatency);
      j += 1;
    }
    const q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM traces
      WHERE workspace_id = $1
      ${filterClauses}
      ORDER BY created DESC
      LIMIT $2 OFFSET $3
      `;
    logger.debug('q:', q);
    logger.debug('values:', values);

    const { rows } = await pg.query(q, values);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getTracesCount(workspaceId, filters, nameQuery, startDate, endDate, success, minLatency, maxLatency) {
    logger.debug('getTracesCount args:', arguments);
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return 0;
    }
    let filterClauses = '';
    let j = 2;
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (Array.isArray(v)) {
          if (typeof v[0] === 'boolean') {
            filterClauses += `AND (val->>'${k}')::BOOLEAN = ANY($${j}::BOOLEAN[]) `;
          } else {
            filterClauses += `AND val->>'${k}' = ANY($${j}::VARCHAR[]) `;
          }
        } else {
          filterClauses += `AND val->>'${k}' = $${j} `;
        }
        j += 1;
      }
    }
    const values = [workspaceId, ...Object.values(filters || {})];
    if (nameQuery) {
      filterClauses += `AND name LIKE $${j}`;
      values.push(`%${nameQuery}%`);
      j += 1;
    }
    if (startDate) {
      filterClauses += `AND created >= $${j} `;
      values.push(startDate);
      j += 1;
    }
    if (endDate) {
      filterClauses += `AND created <= $${j} `;
      values.push(endDate);
      j += 1;
    }
    if (success) {
      filterClauses += `AND (val->'trace'->0->>'success')::BOOLEAN = ANY($${j}) `;
      values.push(success);
      j += 1;
    }
    if (minLatency) {
      filterClauses += `AND (val->'trace'->0->>'elapsedMillis')::INT >= $${j} `;
      values.push(minLatency);
      j += 1;
    }
    if (maxLatency) {
      filterClauses += `AND (val->'trace'->0->>'elapsedMillis')::INT <= $${j} `;
      values.push(maxLatency);
      j += 1;
    }
    let q = `
      SELECT COUNT(*) AS k FROM traces WHERE workspace_id = $1 ${filterClauses}
    `;
    logger.debug('q:', q);
    logger.debug('values:', values);

    const { rows } = await pg.query(q, values);
    return rows[0].k;
  }

  async function getTrace(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM traces
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getLatestTrace() {
    let q = `
      SELECT id, workspace_id, name, created, created_by, modified, modified_by, val
      FROM traces
      ORDER BY id DESC
      LIMIT 1
      `;
    const { rows } = await pg.query(q);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertTrace(trace, username) {
    if (trace === null || typeof trace === 'undefined') {
      return null;
    }
    const omittedFields = ['id', 'workspaceId', 'name', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedTrace = await getTrace(trace.id);
    if (savedTrace) {
      trace = { ...savedTrace, ...trace };
      const val = omit(trace, omittedFields);
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE traces
        SET name = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [trace.name, val, trace.id, modified, trace.id]
      );
      return mapRow(rows[0]);

    } else {
      const val = omit(trace, omittedFields);
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO traces (workspace_id, name, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `,
        [trace.workspaceId, trace.name, val, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteTraces(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM traces WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getLatestTrace,
    getTraces,
    getTracesCount,
    getTrace,
    upsertTrace,
    deleteTraces,
  };
}
