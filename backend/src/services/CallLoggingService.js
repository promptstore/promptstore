import isEmpty from 'lodash.isempty';

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

  const mapRow = (row) => ({
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
    await pg.query(q, keys.map(k => params[k]));
  }

  async function getCallLogs(workspaceId, filter, limit = 10, start = 0) {
    let q = `
      SELECT id, workspace_id, username, provider, model,
      function_id, function_name, system_input,
      output_type, system_output, system_output_text, model_input, 
      model_user_input_text, model_output, model_output_text, val, start_date
      FROM call_log
      WHERE success IS TRUE
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
          if (keys.includes(key)) {
            return `${key}${op}$${i + 3}`;
          }
          return `val->>'${key}'${op}$${i + 3}`;
        })
        .join(' AND ');
      values = Object.values(filter)
        .filter(v => v)
        .map(v => {
          if (v === 'true' || v === 'false' || !isNaN(+v)) {
            return v;
          }
          return `'${v}'`;
        });
      q += ' AND ' + criteria;
    }
    q += ` LIMIT $1 OFFSET $2`;
    logger.debug('query:', q);
    logger.debug('values:', [limit, start, ...values]);
    const { rows } = await pg.query(q, [limit, start, ...values]);
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

  async function updateCallLog(id, evaluation) {
    const savedLog = await getCallLog(id);
    if (savedLog) {
      const modified = new Date();
      const evaluations = savedLog.evaluations || [];
      evaluations.push({ ...evaluation, modified });
      const val = { evaluations };
      const { rows } = await pg.query(`
        UPDATE call_log
        SET val = $1
        WHERE id = $2
        RETURNING *
        `,
        [val, id]
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