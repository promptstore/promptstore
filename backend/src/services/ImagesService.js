import { hashStr } from '../utils';
import omit from 'lodash.omit';

export function ImagesService({ pg, logger }) {

  function mapRow(row) {
    return {
      ...row.val,
      id: row.id,
      workspaceId: row.workspace_id,
      workspaceName: row.workspace_name,
      imageId: row.image_id,
      imageUri: row.image_uri,
      hash: row.hash,
      created: row.created,
      createdBy: row.created_by,
      modified: row.modified,
      modifiedBy: row.modified_by,
    };
  }

  async function getImages(workspaceId, limit = 999, start = 0) {
    let q = `
      SELECT id, workspace_id, image_id, image_uri, hash, created, created_by, modified, modified_by, val
      FROM images
      WHERE workspace_id = $1
      LIMIT $2 OFFSET $3
      `;
    const { rows } = await pg.query(q, [workspaceId, limit, start]);
    return rows.map(mapRow);
  }

  async function getUserImages(userId, limit = 999, start = 0) {
    let q = `
      SELECT id, workspace_id, image_id, image_uri, hash, created, created_by, modified, modified_by, val
      FROM images
      WHERE created_by = $1
      LIMIT $2 OFFSET $3
      `;
    const { rows } = await pg.query(q, [userId, limit, start]);
    return rows.map(mapRow);
  }

  async function getImage(id) {
    if (id === null || typeof id === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, image_id, image_uri, hash, created, created_by, modified, modified_by, val
      FROM images
      WHERE id = $1
      `;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getImageByImageId(imageId) {
    if (imageId === null || typeof imageId === 'undefined') {
      return null;
    }
    let q = `
      SELECT id, workspace_id, image_id, image_uri, hash, created, created_by, modified, modified_by, val
      FROM images
      WHERE image_id = $1
      `;
    const { rows } = await pg.query(q, [imageId]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertImage(image, username, partial) {
    const omittedFields = ['id', 'workspaceId', 'imageId', 'imageUri', 'hash', 'created', 'createdBy', 'modified', 'modifiedBy'];
    const savedImage = await getImage(image.id);
    if (savedImage) {
      if (partial) {
        image = { ...savedImage, ...image };
      }
      const val = omit(image, omittedFields);
      const hash = hashStr(image.objectName);
      if (hash !== savedImage.hash) {
        val.versions = [
          ...(val.versions || []),
          {
            hash: savedImage.hash,
            objectName: savedImage.objectName,
          }
        ];
      }
      const modified = new Date();
      const { rows } = await pg.query(`
        UPDATE images
        SET image_uri = $1, hash = $2, modified_by = $3, modified = $4, val = $5
        WHERE id = $6
        RETURNING *
        `,
        [image.objectName || image.imageUri, hash, username, modified, val, image.id]
      );
      return mapRow(rows[0]);

    } else {
      const created = new Date();
      const hash = hashStr(image.objectName || image.imageUri);
      const val = omit(image, omittedFields);
      const { rows } = await pg.query(`
        INSERT INTO images (workspace_id, image_id, image_uri, hash, created_by, created, modified_by, modified, val)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING *
        `,
        [image.workspaceId, image.imageId, image.objectName || image.imageUri, hash, username, created, username, created, val]
      );
      return mapRow(rows[0]);
    }
  }

  async function deleteImages(ids) {
    await pg.query(`
      DELETE FROM images WHERE id = ANY($1::INT[])
      `, [ids]);
    return ids;
  }

  return {
    deleteImages,
    getImages,
    getImage,
    getImageByImageId,
    getUserImages,
    upsertImage,
  };
}
