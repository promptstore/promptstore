// Backend counterpart to frontend/src/config/roles.js.
//
// The frontend map governs the side menu and router paths; this one governs
// API paths. The two speak different vocabularies and cannot be shared
// literally (CRA cannot import from backend/), so they are kept in step by
// ROLE_MAP_VERSION — bump it in BOTH files on any change.
// frontend/src/config/roles.sync.test.js enforces that.

export const ROLE_MAP_VERSION = 3;

export const ROLES = [
  'admin',
  'ops',
  'promptengineer',
  'aiengineer',
  'knowledgeengineer',
  'evaluator',
];

// Role given to a user who holds no recognised role. Applied at request time
// by `effectiveRoles` and at user-creation time by the login/invite paths.
export const DEFAULT_ROLE = 'promptengineer';

// ---------------------------------------------------------------------------
// Path normalisation and matching
// ---------------------------------------------------------------------------

// Collapse `/api/workspaces/{id}/X` to `/api/X`, but only when a further
// segment follows, so `/api/workspaces` and `/api/workspaces/:id` survive as
// workspace-management paths. This lets one rule cover both the
// workspace-scoped list (`/api/workspaces/3/prompt-sets`) and the by-id form
// (`/api/prompt-sets/7`).
const WORKSPACE_SCOPED = /^\/api\/workspaces\/[^/]+(?=\/)/;

export const normalisePath = (raw) => {
  let p = (raw || '/').split('?')[0];
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p.replace(WORKSPACE_SCOPED, '/api');
};

const escapeSeg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Compile a rule to a segment-boundary regex. Plain `startsWith` is unsafe:
// `/api/index` would wrongly capture `/api/indexes` and `/api/index-status`.
// `:param` segments mean the same matcher also runs against Express route
// templates, which powers findUnmappedRoutes().
const compile = (rule) => {
  const { path, methods = null, exact = false } =
    typeof rule === 'string' ? { path: rule } : rule;
  const source = path
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg === '*' ? '[^/]*' : escapeSeg(seg)))
    .join('/');
  return {
    path,
    // `(?:/.*)?` mirrors the frontend's `p === prefix || p.startsWith(prefix + '/')`
    re: new RegExp('^' + source + (exact ? '' : '(?:/.*)?') + '$'),
    methods: methods && methods.map((m) => m.toUpperCase()),
  };
};

const matches = (c, path, method) =>
  c.re.test(path) && (!c.methods || c.methods.includes(method));

const GET = ['GET'];
const WRITE = ['POST', 'PUT', 'DELETE'];
const g = (path) => ({ path, methods: GET });
const w = (path) => ({ path, methods: WRITE });

// ---------------------------------------------------------------------------
// Allowed to every authenticated console user, regardless of role.
//
// Evaluated FIRST, so rules here must be specific — a loose rule would shadow
// an ADMIN_ONLY entry. The cross-feature GETs are load-bearing: PromptSetsList
// reads functions/models/settings/uploads, TestScenarios reads
// functions/prompt-sets, Composer reads eleven other slices. Narrowing any of
// them will 403 an authoring screen for the role that owns it.
// ---------------------------------------------------------------------------
export const SHARED_API_ACCESS = [
  { path: '/api/users/current', exact: true },
  // Self-service writes. The coarse gate lets these through; routes/users.js
  // does the real check - POST /api/users confines a non-admin to their own
  // record and strips roles/credits, and POST /api/roles requires admin
  // except for the documented first-run bootstrap. Login.js and Register.js
  // self-upsert, and WorkspaceForm's setAdmin() bootstraps, all as non-admins.
  { path: '/api/users', exact: true, methods: ['POST'] },
  { path: '/api/roles', exact: true, methods: ['POST'] },
  { path: '/api/workspaces', exact: true, methods: GET },
  { path: '/api/workspaces/:id', exact: true, methods: GET },
  '/api/statistics',  // <- /api/workspaces/:workspaceId/statistics
  '/api/credits',

  // Static reference lists.
  g('/api/providers'),
  g('/api/custom-model-providers'),
  g('/api/embedding-providers'),
  g('/api/vector-stores'),
  g('/api/graph-stores'),
  g('/api/graphs'),
  g('/api/extractors'),
  g('/api/loaders'),
  g('/api/dialects'),
  g('/api/output-parsers'),
  g('/api/guardrails'),
  g('/api/tools'),
  g('/api/huggingface/models'),

  // Cross-feature reference reads.
  g('/api/settings'),
  g('/api/settings-by-id/:id'),
  g('/api/prompt-sets'),
  g('/api/prompt-set-templates'),
  g('/api/functions'),
  g('/api/functions-by-promptset/:id'),
  g('/api/models'),
  g('/api/models-by-key/:key'),
  g('/api/indexes'),
  g('/api/data-sources'),
  g('/api/rules'),
  g('/api/apps'),

  // File plumbing, used from prompt-sets, functions, models, traces and apps.
  { path: '/api/upload', methods: ['POST'] },
  { path: '/api/object-uploads', methods: ['POST'] },
  { path: '/api/object-duplicates', methods: ['POST'] },
  { path: '/api/presignedurls', methods: ['POST'] },
  '/api/upload-status/:correlationId',
  g('/api/uploads'),
  g('/api/apps/:appId/uploads'),

  g('/api/images'),
  g('/api/users/:userId/images'),

  // API-key surface; governed by the `scopes` model in VerifyToken.
  '/v1/telemetry',
];

// ---------------------------------------------------------------------------
// Known admin-only. Listed explicitly so they are denied even when
// AUTHZ_UNMAPPED_POLICY=allow.
// ---------------------------------------------------------------------------
export const ADMIN_ONLY_API_ACCESS = [
  { path: '/api/workspaces', exact: true, methods: WRITE },
  { path: '/api/workspaces/:id', exact: true, methods: ['PUT', 'DELETE'] },
  '/api/keys',  // <- /api/workspaces/:workspaceId/keys
  '/api/invites',

  { path: '/api/users', exact: true, methods: ['GET', 'DELETE'] },
  '/api/users/id/:id',
  { path: '/api/users/:user_id', exact: true },

  '/api/secrets',
  '/api/secrets-by-name/:name',
  w('/api/settings'),
  { path: '/api/settings-by-id/:id', methods: ['PUT', 'DELETE'] },
  '/api/mirrors',
  '/api/source-workspaces',
  '/api/mirror-executions',
  '/api/telemetry-keys',

  // Legacy traces, distinct from harness-traces; in no restricted role's prefixes.
  '/api/traces',
  '/api/trace-analytics',

  '/api/agent-networks',
  '/api/agent-network-runs',
  '/api/agent-network-status/:correlationId',

  w('/api/rules'),
  '/api/run-rules',
  w('/api/apps'),
  w('/api/images'),
  '/api/bulk-images',
  '/api/image-request',
  '/api/gen-image-variant',
  '/api/edit-image',

  // Budget setting is a spend control, even though `/harness` reads are broad.
  { path: '/api/harness/budgets', methods: ['PUT', 'DELETE'] },

  '/api/rebuild-search-index',
  '/api/reload',
  '/api/bulk-delete',
  '/api/fix-promptset-tag-setting',
  '/api/fix-function-tag-setting',
  '/api/fix-skill-setting',
];

// ---------------------------------------------------------------------------
// Per-role grants, layered like the frontend's PROMPT_ENGINEER_ACCESS pattern.
// ---------------------------------------------------------------------------

const HARNESS_READ = [
  g('/api/harness'),  // cost/*, insights, budgets (GET)
  g('/api/harness-traces'),
  g('/api/harness-sessions'),
  { path: '/api/harness-stream-token', methods: ['POST'] },
  { path: '/api/harness-traces/:traceId/stream-token', methods: ['POST'] },
];

const PROMPT_TESTING = [
  '/api/chat-sessions',
  { path: '/api/chat', methods: ['POST'] },
  { path: '/api/prompts', methods: ['POST'] },
  { path: '/api/completion', methods: ['POST'] },
  { path: '/api/embedding', methods: ['POST'] },
  '/api/rag/:name',
  '/api/executions/:name',
  '/api/composition-executions/:name',
  '/api/tool-executions/:name',
  { path: '/api/search', methods: ['POST'] },
  { path: '/api/sffv', methods: ['POST'] },
];

// Prompt Templates + Prompt Testing + Test Scenarios + harness reads.
// This is the "Context Engineer" grant set.
const PROMPT_ENGINEER_API_ACCESS = [
  ...HARNESS_READ,
  ...PROMPT_TESTING,
  { path: '/api/harness-traces/delete', methods: ['POST'] },
  w('/api/prompt-sets'),
  '/api/test-scenarios',
  '/api/test-scenario-runs',
  '/api/test-scenario-run-status/:correlationId',
];

export const ROLE_API_ACCESS = {
  // Mirrors what the frontend already grants `ops`: harness plus full
  // prompt-sets. Tightening ops to read-only requires a matching frontend
  // change, or the edit buttons it can already see would 403.
  ops: [
    ...HARNESS_READ,
    ...PROMPT_TESTING,
    w('/api/prompt-sets'),
  ],

  promptengineer: PROMPT_ENGINEER_API_ACCESS,

  aiengineer: [
    ...PROMPT_ENGINEER_API_ACCESS,
    w('/api/functions'),
    '/api/compositions',
    w('/api/models'),
    '/api/agents',
    '/api/mcp-servers',
    '/api/agent-executions',
    '/api/agent-execution-status/:correlationId',
  ],

  evaluator: [
    ...PROMPT_ENGINEER_API_ACCESS,
    '/api/evaluations',
    '/api/evaluation-runs',
    '/api/evaluation-status/:correlationId',
    '/api/training',
    '/api/logs-request',
    '/api/content/:contentId/training',
    g('/api/transformations'),  // EvaluationForm imports transformationsSlice
  ],

  knowledgeengineer: [
    ...PROMPT_TESTING,  // RAG Testing is a chat surface
    { path: '/api/prompt-sets', methods: ['POST'] },  // RagTester "save as prompt set"
    '/api/uploads',
    '/api/data-sources',
    '/api/destinations',
    '/api/indexes',
    '/api/graphs',
    '/api/graph-stores',
    '/api/index',
    '/api/index-status/:correlationId',
    '/api/chunks/:vectorStoreProvider/:name',
    '/api/embeddings/:embeddingProvider',
    '/api/transformations',
    '/api/transformation-runs/:id',
    '/api/transformation-status/:correlationId',
    '/api/schedules/:scheduleId',
  ],
};

// ---------------------------------------------------------------------------
// Compiled sets and the public predicate
// ---------------------------------------------------------------------------

const compileAll = (rules) => rules.map(compile);

const SHARED_C = compileAll(SHARED_API_ACCESS);
const ADMIN_C = compileAll(ADMIN_ONLY_API_ACCESS);
const ROLE_C = Object.fromEntries(
  Object.entries(ROLE_API_ACCESS).map(([role, rules]) => [role, compileAll(rules)])
);
const KNOWN_C = [...SHARED_C, ...ADMIN_C, ...Object.values(ROLE_C).flat()];

// Fail-closed by default. `allow` only affects paths matched by NO rule at
// all — a known-but-not-granted path is always denied, so this can never
// re-open /api/secrets.
const UNMAPPED_ALLOW = process.env.AUTHZ_UNMAPPED_POLICY === 'allow';

export const isAdmin = (user) => !!user?.roles?.includes('admin');

// Unlike the frontend's `isRestricted`, which treats a role-less user as
// unrestricted, the backend substitutes DEFAULT_ROLE. Copying the frontend's
// fail-open here would give every invited user full API access.
const effectiveRoles = (user) => {
  const held = (user?.roles || []).filter((r) => ROLE_API_ACCESS[r]);
  return held.length ? held : [DEFAULT_ROLE];
};

export const isApiPathAllowed = (user, rawPath, rawMethod = 'GET') => {
  if (isAdmin(user)) return { allowed: true, reason: 'admin' };

  const path = normalisePath(rawPath);
  const method = (rawMethod || 'GET').toUpperCase();

  if (SHARED_C.some((c) => matches(c, path, method))) {
    return { allowed: true, reason: 'shared' };
  }

  for (const role of effectiveRoles(user)) {
    if (ROLE_C[role]?.some((c) => matches(c, path, method))) {
      return { allowed: true, reason: `role:${role}` };
    }
  }

  // Known path, just not granted to this role -> always denied.
  if (KNOWN_C.some((c) => matches(c, path, method))) {
    return { allowed: false, reason: 'not-granted' };
  }

  return { allowed: UNMAPPED_ALLOW, reason: 'unmapped' };
};

// Startup coverage check. Express route templates use the same `:param`
// syntax as rules, so the compiled matchers work on them directly.
export const findUnmappedRoutes = (routePaths) =>
  routePaths.filter((p) => {
    const n = normalisePath(p);
    return !KNOWN_C.some((c) => c.re.test(n));
  });
