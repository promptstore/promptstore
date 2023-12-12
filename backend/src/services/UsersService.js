import omit from 'lodash.omit';

export function UsersService({ pg }) {

  function mapRow(row) {
    return {
      id: row.id,
      username: row.username,
      ...row.val,
    };
  }

  async function getUsers() {
    let q = `SELECT id, username, val from users `;
    const { rows } = await pg.query(q);
    return rows.map(mapRow);
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
    return mapRow(rows[0]);
  }

  async function getUserByEmail(email) {
    let q =
      `SELECT id, username, val from users ` +
      `WHERE val->>'email' = $1`;
    const { rows } = await pg.query(q, [email]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getUserById(id) {
    let q =
      `SELECT id, username, val from users ` +
      `WHERE id = $1`;
    const { rows } = await pg.query(q, [id]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function getUserByKeycloakId(keycloakId) {
    let q =
      `SELECT id, username, val from users ` +
      `WHERE val->>'keycloakId' = $1`;
    const { rows } = await pg.query(q, [keycloakId]);
    if (rows.length === 0) {
      return null;
    }
    return mapRow(rows[0]);
  }

  async function upsertUser(user) {
    const savedUser = await getUser(user.username);
    if (savedUser) {
      const val = {
        ...omit(savedUser, ['id', 'userId']),
        ...user
      };
      const { rows } = await pg.query(
        `UPDATE users ` +
        `SET val = $1 ` +
        `WHERE username = $2` +
        `RETURNING *`,
        [val, user.username]
      );
      return mapRow(rows[0]);
    } else {
      const { rows } = await pg.query(
        `INSERT INTO users (username, val) ` +
        `VALUES ($1, $2) RETURNING *`,
        [user.username, user]
      );
      return mapRow(rows[0]);
    }
  }

  return {
    getUsers,
    getUser,
    getUserByEmail,
    getUserById,
    getUserByKeycloakId,
    setRole,
    upsertUser,
  };
}
