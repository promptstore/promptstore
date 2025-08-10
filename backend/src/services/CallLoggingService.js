import isEmpty from 'lodash.isempty';
import omit from 'lodash.omit';

export function CallLoggingService({ pg, logger }) {
  const keys = [
    'workspace_id',
    'username',
    'type',
    'provider',
    'model',
    'function_id',
    'function_name',
    'system_input',
    'output_type',
    'system_output',
    'system_output_text',
    'model_input',
    'model_user_input_text',
    'model_output',
    'model_output_text',
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
    'image_uploaded_count',
    'image_generated_count',
    'video_secs',
    'latency_ms',
    'success',
    'error',
    'val',
    'start_date',
    'end_date',
  ];

  const mapRow = row => ({
    ...row.val,
    id: row.id,
    workspaceId: row.workspace_id,
    username: row.username,
    provider: row.provider,
    model: row.model,
    functionId: row.function_id,
    functionName: row.function_name,
    systemInput: row.system_input,
    outputType: row.output_type,
    systemOutput: row.system_output,
    systemOutputText: row.system_output_text,
    modelInput: row.model_input,
    modelUserInputText: row.model_user_input_text,
    modelOutput: row.model_output,
    modelOutputText: row.model_output_text,
    startDate: row.start_date,
  });

  async function createCallLog(params) {
    const q = `
      INSERT INTO call_log (${keys.join(', ')})
      VALUES (${[...Array(keys.length)].map((_, i) => `$${i + 1}`)})
    `;
    logger.debug('call log q:', q);
    await pg.query(
      q,
      keys.map(k => params[k])
    );
  }

  async function getCallLogs(workspaceId, filter, limit = 50, start = 0, filterEvals = false) {
    let q = `
      SELECT l.id, l.workspace_id, l.username, l.provider, l.model,
      l.function_id, l.function_name, l.system_input,
      l.output_type, l.system_output, l.system_output_text, l.model_input, 
      l.model_user_input_text, l.model_output, l.model_output_text, l.val, l.start_date
      FROM call_log l
      WHERE l.success IS TRUE AND l.workspace_id = $1
    `;
    let values = [];
    if (!isEmpty(filter)) {
      const criteria = Object.entries(filter)
        .filter(([k, v]) => v)
        .map(([k, v], i) => {
          const match = /(.+?)\[(.+?)\]$/.exec(k);
          let key = k;
          let op = '=';
          if (match) {
            key = match[1];
            op = match[2];
          }

          // Handle special case for existence check
          if (v === '_exists_') {
            if (keys.includes(key)) {
              return `l.${key} IS NOT NULL`;
            }
            return `l.val->>'${key}' IS NOT NULL`;
          }

          // Handle special case for null check
          if (v === '_isnull_') {
            if (keys.includes(key)) {
              return `l.${key} IS NULL`;
            }
            return `l.val->>'${key}' IS NULL`;
          }

          if (keys.includes(key)) {
            return `l.${key}${op}$${i + 4}`;
          }
          return `l.val->>'${key}'${op}$${i + 4}`;
        })
        .join(' AND ');

      values = Object.values(filter)
        .filter(v => v && !['_exists_', '_isnull_'].includes(v))
        .map(v => {
          if (v === 'true' || v === 'false' || !isNaN(+v)) {
            return v;
          }
          return `${v}`;
        });
      q += `
        AND ${criteria}
      `;
    }
    if (filterEvals) {
      const s1 = q.split(/\s+FROM\s+/);
      const s2 = s1[1].split(/\s+WHERE\s+/);
      q = `
        WITH logs AS (
          ${s1[0]}
          , ((f.val->'tags')::jsonb @> '"eval"') AS is_eval
          FROM ${s2[0]}
          JOIN functions f ON l.function_id = f.id
          WHERE ${s2[1]}
        )
        SELECT * FROM logs l
        WHERE l.is_eval IS NULL OR l.is_eval IS FALSE
      `;
    }
    q += `
      ORDER BY l.start_date DESC
      LIMIT $2 OFFSET $3
    `;

    logger.debug('query:', q);
    logger.debug('values:', [workspaceId, limit, start, ...values]);
    const { rows } = await pg.query(q, [workspaceId, limit, start, ...values]);
    return rows.map(mapRow);
  }

  async function getCallLogsById(ids) {
    let q = `
      SELECT id, workspace_id, username, provider, model,
      function_id, function_name, system_input,
      output_type, system_output, system_output_text, model_input, 
      model_user_input_text, model_output, model_output_text, val, start_date
      FROM call_log
      WHERE id = ANY($1::INT[])
    `;
    const { rows } = await pg.query(q, [ids]);
    return rows.map(mapRow);
  }

  async function getCallLog(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, username, provider, model,
      function_id, function_name, system_input,
      output_type, system_output, system_output_text, model_input, 
      model_user_input_text, model_output, model_output_text, val, start_date
      FROM call_log
      WHERE id = $1
    `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function updateCallLog(id, values) {
    const savedLog = await getCallLog(id);
    if (savedLog) {
      const val = omit(savedLog, [
        'id',
        'workspaceId',
        'username',
        'provider',
        'model',
        'functionId',
        'functionName',
        'systemInput',
        'outputType',
        'systemOutput',
        'systemOutputText',
        'modelInput',
        'modelUserInputText',
        'modelOutput',
        'modelOutputText',
        'startDate',
      ]);
      if (values.evaluations) {
        const modified = new Date();
        const evaluations = savedLog.evaluations || [];
        const evals = values.evaluations.map(e => ({ ...e, modified }));
        evaluations.push(...evals);
        values = { ...values, evaluations };
      }
      values = { ...val, ...values };
      const { rows } = await pg.query(
        `
        UPDATE call_log
        SET val = $1
        WHERE id = $2
        RETURNING *
        `,
        [values, id]
      );
      return mapRow(rows[0]);
    }
    return null;
  }

  return {
    createCallLog,
    getCallLogs,
    getCallLogsById,
    getCallLog,
    updateCallLog,
  };
}
