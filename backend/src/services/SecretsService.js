import isObject from 'lodash.isobject';

export function SecretsService({ pg, logger }) {

  function mapRow(row) {
    return {
      id: row.id,
      name: row.name,
      value: row.value,
      workspaceId: row.workspace_id,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getSecrets(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, name, value, created, created_by, modified, modified_by
      FROM secrets
      WHERE workspace_id = $1
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    return rows.map(mapRow);
  }

  async function getSecretByName(workspaceId, name) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return null;
    }
    if (name === null || typeof name === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, value, created, created_by, modified, modified_by
      FROM secrets
      WHERE workspace_id = $1
      AND name = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, name]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getSecret(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, name, value, created, created_by, modified, modified_by
      FROM secrets
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertSecret(secret, username) {
    if (secret === null || typeof secret === 'undefined') {
      return null;
    }
    const savedSecret = await getSecret(secret.id);
    if (savedSecret) {
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE secrets
        SET name = $1, value = $2, modified_by = $3, modified = $4
        WHERE id = $5
        RETURNING *
        `,
        [secret.name, secret.value, username, modified, secret.id]
      );
      return mapRow(rows[0]);
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO secrets (workspace_id, name, value, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `,
        [secret.workspaceId, secret.name, secret.value, username, created, username, created]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteSecrets(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM secrets WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  async function interpolateSecrets(workspaceId, str) {
    const re = /\{(.*?)\}/g;
    let newStr = str;
    let result;
    while (result = re.exec(str)) {
      const secret = await getSecretByName(workspaceId, result[1]);
      if (secret) {
        newStr = newStr.replace(result[0], secret.value);
      }
    }
    return newStr;
  }

  const DEFAULT_INTERPOLATION_PROPS = ['connectionString'];

  function interpolateSecretsInObject(workspaceId, object, interpolationProps) {
    if (!interpolationProps) {
      interpolationProps = DEFAULT_INTERPOLATION_PROPS;
    }

    async function interpolate(obj) {
      if (Array.isArray(obj)) {
        const newArr = [];
        for (const item of obj) {
          const newItem = await interpolate(item);
          newArr.push(newItem);
        }
        return newArr;
      }
      if (isObject(obj)) {
        const newObj = {};
        for (const key in obj) {
          if (interpolationProps.includes(key) && typeof obj[key] === 'string') {
            newObj[key] = await interpolateSecrets(workspaceId, obj[key]);
          } else {
            newObj[key] = await interpolate(obj[key]);
          }
        }
        return newObj;
      }
      return obj;
    }

    return interpolate(object);
  }

  return {
    getSecrets,
    getSecretByName,
    getSecret,
    interpolateSecrets,
    interpolateSecretsInObject,
    upsertSecret,
    deleteSecrets,
  };
}
