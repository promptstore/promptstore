// Exercise the fine-grained guards in routes/users.js directly.
const usersRoute = (await import('../../src/routes/users.js')).default;

const handlers = {};
const app = {
  get: (p, a, h) => { handlers['GET ' + p] = h; },
  post: (p, a, h) => { handlers['POST ' + p] = h; },
  delete: (p, a, h) => { handlers['DELETE ' + p] = h; },
};

let adminCount = 1;          // pretend an admin already exists
const upserted = [];
const rolesSet = [];
const usersService = {
  getUser: async (u) => ({ username: u }),
  getUsers: async () => [],
  getUserById: async () => ({}),
  deleteUsers: async (ids) => ids,
  upsertUser: async (b) => { upserted.push(b); return b; },
  setRoles: async (u, r) => { rolesSet.push([u, r]); },
  countAdmins: async () => adminCount,
};
usersRoute({ app, auth: () => {}, logger: { debug(){}, warn(){} }, services: { usersService } });

const call = async (key, { user, body = {}, query = {} }) => {
  let code = 200, payload;
  const res = {
    status(c) { code = c; return this; },
    json(p) { payload = p; return this; },
    sendStatus(c) { code = c; return this; },
  };
  await handlers[key]({ user, body, query }, res);
  return { code, payload };
};

const PE = { username: 'pe@x', roles: ['promptengineer'] };
const AD = { username: 'ad@x', roles: ['admin'] };

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

// --- POST /api/roles -------------------------------------------------------
let r = await call('POST /api/roles', { user: PE, body: { role: 'admin' } });
check('non-admin self-promote blocked (admin exists)', r.code === 403, JSON.stringify(r));

r = await call('POST /api/roles', { user: PE, body: { username: 'victim@x', role: 'admin' } });
check('non-admin promoting others blocked', r.code === 403, JSON.stringify(r));

r = await call('POST /api/roles', { user: AD, body: { username: 'u@x', roles: ['evaluator'] } });
check('admin can set roles', r.code === 200 && rolesSet.at(-1)[1][0] === 'evaluator', JSON.stringify(r));

r = await call('POST /api/roles', { user: AD, body: { username: 'u@x', role: 'admin"],"credits":[999999' } });
check('injection payload rejected as unknown role', r.code === 400, JSON.stringify(r));

r = await call('POST /api/roles', { user: AD, body: { username: 'u@x' } });
check('missing role rejected', r.code === 400, JSON.stringify(r));

// First-run bootstrap: no admin exists yet.
adminCount = 0;
r = await call('POST /api/roles', { user: PE, body: { role: 'admin' } });
check('bootstrap: first user may self-grant admin', r.code === 200, JSON.stringify(r));
r = await call('POST /api/roles', { user: PE, body: { username: 'other@x', role: 'admin' } });
check('bootstrap does not extend to other users', r.code === 403, JSON.stringify(r));
adminCount = 1;

// --- POST /api/users -------------------------------------------------------
r = await call('POST /api/users', { user: PE, body: { username: 'pe@x', roles: ['admin'], credits: 99999, firstName: 'A' } });
const last = upserted.at(-1);
check('non-admin self-upsert allowed', r.code === 200);
check('non-admin roles stripped', last && last.roles === undefined, JSON.stringify(last));
check('non-admin credits stripped', last && last.credits === undefined, JSON.stringify(last));

r = await call('POST /api/users', { user: PE, body: { username: 'other@x', firstName: 'B' } });
check('non-admin cannot upsert another user', r.code === 403, JSON.stringify(r));

r = await call('POST /api/users', { user: AD, body: { username: 'u@x', roles: ['evaluator'] } });
check('admin may set valid roles', r.code === 200, JSON.stringify(r));

r = await call('POST /api/users', { user: AD, body: { username: 'u@x', roles: ['wizard'] } });
check('admin blocked from unknown role', r.code === 400, JSON.stringify(r));

// --- DELETE /api/users -----------------------------------------------------
r = await call('DELETE /api/users', { user: PE, query: { ids: '1,2' } });
check('non-admin cannot delete users', r.code === 403, JSON.stringify(r));
r = await call('DELETE /api/users', { user: AD, query: { ids: '1,2' } });
check('admin can delete users', r.code === 200, JSON.stringify(r));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
