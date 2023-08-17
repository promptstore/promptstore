import omit from 'lodash.omit';

export function UsersService({ pg }) {

  async function getUsers() {
    let q = `SELECT id, username, val from users `;
    const { rows } = await pg.query(q);
    const users = rows.map((row) => ({
      id: row.id,
      username: row.username,
      ...row.val,
    }));
    return users;
  }

  async function setRole(username, role) {
    let q = `
      UPDATE users
      SET val = jsonb_set(val::jsonb, '{roles}', '["${role}"]'::jsonb)
      WHERE username = $1
    `;
    await pg.query(q, [username]);
  }

  async function getUser(username) {
    let q =
      `SELECT id, username, val from users ` +
      `WHERE username = $1`;
    const { rows } = await pg.query(q, [username]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      id: row.id,
      username: row.username,
      ...row.val,
    };
  }

  async function getUserById(id) {
    let q =
      `SELECT id, username, val from users ` +
      `WHERE id = $1`;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      id: row.id,
      username: row.username,
      ...row.val,
    };
  }

  async function getUserByKeycloakId(keycloakId) {
    let q =
      `SELECT id, username, val from users ` +
      `WHERE val->>'keycloakId' = $1`;
    const { rows } = await pg.query(q, [keycloakId]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      id: row.id,
      username: row.username,
      ...row.val,
    };
  }

  async function upsertUser(user) {
    const savedUser = await getUser(user.username);
    if (savedUser) {
      const val = {
        ...omit(savedUser, ['id', 'userId']),
        ...user
      };
      await pg.query(
        `UPDATE users ` +
        `SET val = $1 ` +
        `WHERE username = $2`,
        [val, user.username]
      );
      return { ...savedUser, ...user };
    } else {
      const { rows } = await pg.query(
        `INSERT INTO users (username, val) ` +
        `VALUES ($1, $2) RETURNING id`,
        [user.username, user]
      );
      return { ...user, id: rows[0].id };
    }
  }

  return {
    getUsers,
    getUser,
    getUserById,
    getUserByKeycloakId,
    setRole,
    upsertUser,
  };
}
