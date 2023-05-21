const omit = require('lodash.omit');

function PromptSetsService({ pg, logger }) {

  async function getPromptSets(workspaceId) {
    let q = `
      SELECT id, workspace_id, skill, created, created_by, modified, modified_by, val
      FROM prompt_sets
      `;
    let params = [];
    if (workspaceId) {
      q += `WHERE workspace_id = $1`;
      params = [workspaceId];
    }
    const { rows } = await pg.query(q, params);
    if (rows.length === 0) {
      return [];
    }
    const promptSets = rows.map((row) => ({
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspaceId,
      skill: row.skill,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return promptSets;
  }

  async function getPromptSetBySkill(skill) {
    if (skill === null || typeof skill === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, skill, created, created_by, modified, modified_by, val
      FROM prompt_sets
      WHERE skill = $1
      `;
    const { rows } = await pg.query(q, [skill]);
    if (rows.length === 0) {
      return [];
    }
    const promptSets = rows.map((row) => ({
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspaceId,
      skill: row.skill,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return promptSets;
  }

  async function getPromptSet(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, skill, created, created_by, modified, modified_by, val
      FROM prompt_sets
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspaceId,
      skill: row.skill,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertPromptSet(promptSet) {
    if (promptSet === null || typeof promptSet === 'undefined') {
      return null;
    }
    const val = omit(promptSet, ['id', 'workspaceId', 'skill', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedPromptSet = await getPromptSet(promptSet.id);
    if (savedPromptSet) {
      await pg.query(`
        UPDATE prompt_sets
        SET skill = $1, val = $2
        WHERE id = $3
        `,
        [promptSet.skill, val, promptSet.id]
      );
      return promptSet.id;
    } else {
      const { rows } = await pg.query(`
        INSERT INTO prompt_sets (workspace_id, skill, val)
        VALUES ($1, $2, $3) RETURNING id
        `,
        [promptSet.workspaceId, promptSet.skill, val]
      );
      return rows[0].id;
    }
  }

  async function deletePromptSets(ids) {
    if (ids === null || typeof ids === 'undefined') {
      return [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    await pg.query(`
      DELETE FROM prompt_sets WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    getPromptSets,
    getPromptSetBySkill,
    getPromptSet,
    upsertPromptSet,
    deletePromptSets,
  };
}

module.exports = {
  PromptSetsService,
};
