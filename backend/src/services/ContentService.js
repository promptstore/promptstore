import omit from 'lodash.omit';

import { hashStr } from '../utils';

export function ContentService({ pg, logger }) {

  // TODO - upgrade postgres
  // async function getContentsForReview(userId, limit = 999, start = 0) {
  //   let q = `
  //     SELECT id, app_id, content_id, text, hash, created, created_by, modified, modified_by, val
  //     FROM content c, json_array_elements_text(c.val->'reviewers') reviewer
  //     WHERE reviewer = $1
  //     LIMIT $2 OFFSET $3
  //     `;
  //   const { rows } = await pg.query(q, [userId, limit, start]);
  //   const contents = rows.map((row) => ({
  //     ...row.val,
  //     id: row.id,
  //     appId: row.app_id,
  //     contentId: row.content_id,
  //     text: row.text,
  //     hash: row.hash,
  //     created: row.created,
  //     createdBy: row.created_by,
  //     modified: row.modified,
  //     modifiedBy: row.modified_by,
  //   }));
  //   return contents;
  // }

  async function getContentsForReview(userId, limit = 999, start = 0) {
    let q = `
      SELECT id, app_id, content_id, text, hash, created, created_by, modified, modified_by, val
      FROM content c
      LIMIT $1 OFFSET $2
      `;
    const { rows } = await pg.query(q, [limit, start]);
    const contents = rows
      .filter((row) => row.val.reviewers && row.val.reviewers.indexOf(userId) !== -1)
      .map((row) => ({
        ...row.val,
        id: row.id,
        appId: row.app_id,
        contentId: row.content_id,
        text: row.text,
        hash: row.hash,
        created: row.created,
        createdBy: row.created_by,
        modified: row.modified,
        modifiedBy: row.modified_by,
      }))
      ;
    return contents;
  }

  async function getContentsByFilter(params, limit = 999, start = 0) {
    // logger.debug('params: ', params);
    let q = `
      SELECT c.id, c.app_id, c.content_id, c.text, c.hash, c.created, c.created_by, c.modified, c.modified_by, c.val
      FROM content c
    `;
    let i = 1, values = [];
    const username = params.username;
    if (username) {
      q += `
        JOIN apps a ON a.id = c.app_id::INT
        JOIN workspaces p ON p.id = a.workspace_id::INT
        WHERE $${i++} = ANY(json_property_to_varchar_array(p.val->'members', 'username'))
      `;
      values.push(username);
      delete params.username;
    }
    const conditions = [];
    for (const key in params) {
      conditions.push(`c.val->>'$${key}' = $${i++}`);
    }
    if (conditions.length) {
      q += username ? 'WHERE ' : 'AND ';
      q += conditions.join(' AND ');
    }
    q += ` LIMIT $${i++} OFFSET $${i++}`;
    // logger.debug('getContentsByFilter: ', q);
    values = [...values, ...Object.values(params), limit, start];
    // logger.debug('values: ', values);
    const { rows } = await pg.query(q, values);
    const contents = rows.map((row) => ({
      ...row.val,
      id: row.id,
      appId: row.app_id,
      contentId: row.content_id,
      text: row.text,
      hash: row.hash,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return contents;
  }

  async function getContents(appId, limit = 999, start = 0) {
    let q = `
      SELECT id, app_id, content_id, text, hash, created, created_by, modified, modified_by, val
      FROM content
      WHERE app_id = $1
      LIMIT $2 OFFSET $3
      `;
    const { rows } = await pg.query(q, [appId, limit, start]);
    const contents = rows.map((row) => ({
      ...row.val,
      id: row.id,
      appId: row.app_id,
      contentId: row.content_id,
      text: row.text,
      hash: row.hash,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    }));
    return contents;
  }

  async function getContent(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, app_id, content_id, text, hash, created, created_by, modified, modified_by, val
      FROM content
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      ...row.val,
      id: row.id,
      appId: row.app_id,
      contentId: row.content_id,
      text: row.text,
      hash: row.hash,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getContentByContentId(contentId) {
    if (contentId === null || typeof contentId === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, app_id, content_id, text, hash, created, created_by, modified, modified_by, val
      FROM content
      WHERE content_id = $1
      `;
    const { rows } = await pg.query(q, [contentId]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      ...row.val,
      id: row.id,
      appId: row.app_id,
      contentId: row.content_id,
      text: row.text,
      hash: row.hash,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function upsertContent(content) {
    const val = omit(content, ['id', 'appId', 'contentId', 'text', 'hash', 'created', 'createdBy', 'modified', 'modifiedBy']);
    const savedContent = await getContent(content.id);
    if (savedContent) {
      const hash = hashStr(content.text);
      if (hash !== savedContent.hash) {
        val.versions = [
          ...(val.versions || []),
          {
            created: (new Date()).toISOString(),
            hash: savedContent.hash,
            text: savedContent.text,
          }
        ];
      }
      const modified = (new Date()).toISOString();
      await pg.query(`
        UPDATE content
        SET text = $1, hash = $2, modified_by = $3, modified = $4, val = $5
        WHERE id = $6
        `,
        [content.text, hash, content.modifiedBy, modified, val, content.id]
      );
      return { ...content, hash, modified, ...val };
    } else {
      const { rows } = await pg.query(`
        INSERT INTO content (app_id, content_id, text, hash, created_by, modified_by, val)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
        `,
        [content.appId, content.contentId, content.text, hashStr(content.text), content.createdBy, content.modifiedBy, val]
      );
      return rows[0].id;
    }
  }

  async function deleteContents(ids) {
    await pg.query(`
      DELETE FROM content WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    deleteContents,
    getContentsByFilter,
    getContentsForReview,
    getContents,
    getContent,
    getContentByContentId,
    upsertContent,
  };
}
