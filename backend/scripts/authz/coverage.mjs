// Collect every route path each route module registers, by handing the module
// a stub `app`, then run the authz coverage check over them. Avoids booting
// Postgres/Redis/Temporal.
import fs from 'fs';
import path from 'path';

const ROUTES = path.resolve(import.meta.dirname, '../../src/routes');
const { findUnmappedRoutes, isApiPathAllowed } =
  await import('../../src/config/roles.js');

const registered = [];
const AUTH = function auth() {};
const mk = () => {
  const rec = (m) => (p, ...rest) => {
    if (typeof p === 'string') registered.push({ method: m.toUpperCase(), path: p, authed: rest.includes(AUTH) });
  };
  return { get: rec('get'), post: rec('post'), put: rec('put'), delete: rec('delete'),
           patch: rec('patch'), all: rec('all'), use: () => {} };
};

// Deep proxy so any services.xService.method() destructure works.
const anyProxy = new Proxy(function(){}, {
  get: (t, k) => {
    if (k === 'then') return undefined;
    if (k === Symbol.toPrimitive) return () => 'stub';
    if (k === Symbol.toStringTag || k === 'toString') return () => 'stub';
    return anyProxy;
  },
  apply: () => anyProxy,
  construct: () => anyProxy,
});

const files = fs.readdirSync(ROUTES).filter(f => f.endsWith('.js')).sort();
const failed = [];
for (const f of files) {
  const before = registered.length;
  try {
    const mod = await import(path.join(ROUTES, f));
    mod.default({
      app: mk(), auth: AUTH, constants: anyProxy, logger: anyProxy,
      mc: anyProxy, pg: anyProxy, passport: anyProxy,
      services: anyProxy, workflowClient: anyProxy,
    });
  } catch (e) {
    failed.push(`${f}: ${e.message.split('\n')[0]}`);
  }
  if (registered.length === before && !failed.some(x => x.startsWith(f))) {
    failed.push(`${f}: registered 0 routes`);
  }
}

const apiPaths = registered
  .filter(r => r.authed && (r.path.startsWith('/api/') || r.path.startsWith('/v1/')))
  .map(r => r.path);
console.log(`unauthenticated routes (authz never runs): ${
  [...new Set(registered.filter(r => !r.authed && r.path.startsWith('/api')).map(r => r.path))].join(', ')}`);

console.log(`route files loaded: ${files.length - failed.length}/${files.length}`);
if (failed.length) { console.log('COULD NOT LOAD:'); failed.forEach(x => console.log('  ' + x)); }
console.log(`api routes collected: ${apiPaths.length}`);

const unmapped = [...new Set(findUnmappedRoutes(apiPaths))];
console.log(`\n=== UNMAPPED (${unmapped.length}) ===`);
unmapped.forEach(p => console.log('  ' + p));
if (unmapped.length) {
  console.log('\nThese auth-gated routes have no rule in src/config/roles.js and');
  console.log('will be denied to non-admins. Add them to SHARED, ADMIN_ONLY or a role.');
}

// Per-role reachability of every collected route.
const roles = ['ops','promptengineer','aiengineer','knowledgeengineer','evaluator'];
const uniq = [...new Map(registered.filter(r => r.authed && (r.path.startsWith('/api/')||r.path.startsWith('/v1/')))
  .map(r => [r.method+' '+r.path, r])).values()];
console.log('\n=== DENIED PER ROLE (count) ===');
for (const role of roles) {
  const denied = uniq.filter(r => !isApiPathAllowed({roles:[role]}, r.path, r.method).allowed);
  console.log(`${role}: ${denied.length}/${uniq.length} denied`);
}

if (failed.length || unmapped.length) process.exit(1);
