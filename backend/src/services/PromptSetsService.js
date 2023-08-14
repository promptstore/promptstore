import omit from 'lodash.omit';

export function PromptSetsService({ pg, logger }) {

  async function getPromptSets(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, skill, created, created_by, modified, modified_by, val
      FROM prompt_sets
      WHERE workspace_id = $1
      OR (val->>'isPublic')::boolean = true
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    const promptSets = rows.map((row) => ({
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspace_id,
      skill: row.skill,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return promptSets;
  }

  async function getPromptSetsBySkill(workspaceId, skill) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    if (skill === null || typeof skill === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, skill, created, created_by, modified, modified_by, val
      FROM prompt_sets
      WHERE (workspace_id = $1 OR (val->>'isPublic')::boolean = true)
      AND skill = $2
      `;
    const { rows } = await pg.query(q, [workspaceId, skill]);
    if (rows.length === 0) {
      return [];
    }
    const promptSets = rows.map((row) => ({
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspace_id,
      skill: row.skill,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return promptSets;
  }

  async function getFirstPromptSetBySkillAsMessages(workspaceId, skill) {
    const promptSets = await getPromptSetsBySkill(workspaceId, skill);
    if (promptSets.length) {
      return promptSets[0].prompts.map((p) => ({
        role: p.role,
        content: p.prompt,
      }));
    }
    return null;
  }

  async function getPromptSetTemplates(workspaceId) {
    if (workspaceId === null || typeof workspaceId === 'undefined') {
      return [];
    }
    let q = `
      SELECT id, workspace_id, skill, created, created_by, modified, modified_by, val
      FROM prompt_sets p
      WHERE (workspace_id = $1 OR (val->>'isPublic')::boolean = true)
      AND p.val->>'isTemplate' = 'true'
      `;
    const { rows } = await pg.query(q, [workspaceId]);
    if (rows.length === 0) {
      return [];
    }
    const promptSets = rows.map((row) => ({
      ...row.val,
      name: row.val.name || row.key,
      id: row.id,
      workspaceId: row.workspace_id,
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
      workspaceId: row.workspace_id,
      skill: row.skill,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertPromptSet(promptSet, username) {
    if (promptSet === null || typeof promptSet === 'undefined') {
      return null;
    }
    const val = omit(promptSet, ['id', 'workspaceId', 'skill', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedPromptSet = await getPromptSet(promptSet.id);
    if (savedPromptSet) {
      await pg.query(`
        UPDATE prompt_sets
        SET skill = $1, val = $2, modified_by = $3, modified = $4
        WHERE id = $5
        `,
        [promptSet.skill, val, username, new Date(), promptSet.id]
      );
      return { ...savedPromptSet, ...promptSet };
    } else {
      const created = new Date();
      const { rows } = await pg.query(`
        INSERT INTO prompt_sets (workspace_id, skill, val, created_by, created, modified_by, modified)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `,
        [promptSet.workspaceId, promptSet.skill, val, username, created, username, created]
      );
      return { ...promptSet, id: rows[0].id };
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
    getFirstPromptSetBySkillAsMessages,
    getPromptSets,
    getPromptSetsBySkill,
    getPromptSetTemplates,
    getPromptSet,
    upsertPromptSet,
    deletePromptSets,
  };
}
