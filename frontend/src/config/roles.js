// Central definition of application roles and the access rules for restricted
// (non-admin) roles. Keeping this in one place avoids scattering role string
// literals across the codebase.

// Options offered by the admin-only Roles multi-select in the user form.
export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'ops', label: 'Ops' },
  { value: 'promptengineer', label: 'Prompt Engineer' },
  { value: 'aiengineer', label: 'AI Engineer' },
  { value: 'knowledgeengineer', label: 'Knowledge Engineer' },
  { value: 'evaluator', label: 'Evaluator' },
];

// Access for the `promptengineer` role, defined up front so `aiengineer` can
// extend it.
const PROMPT_ENGINEER_ACCESS = {
  menuKeys: [
    'home',
    'prompt-engineering',
    'prompt-sets',
    'prompt-designer',
    'test-scenarios',
    'debugging',
    'harness',
    'harness-cost',
    'harness-insights',
  ],
  pathPrefixes: [
    '/home',
    '/prompt-sets',
    '/design',
    '/test-scenarios',
    '/harness',
    '/profile',
  ],
};

// Per-role access definitions for restricted (non-admin) roles.
//   menuKeys     — side-menu item keys the role may see. Parent group keys
//                  (`prompt-engineering`, `debugging`) are included so the
//                  groups survive filtering when they contain an allowed child.
//   pathPrefixes — route path prefixes the role may navigate to. A prefix match
//                  covers sub-routes (e.g. `/harness/cost`, `/prompt-sets/:id/edit`).
//                  `/profile` is always allowed as a baseline (own account).
const RESTRICTED_ROLE_ACCESS = {
  ops: {
    menuKeys: [
      'home',
      'prompt-engineering',
      'prompt-sets',
      'debugging',
      'harness',
      'harness-cost',
      'harness-insights',
    ],
    pathPrefixes: ['/home', '/prompt-sets', '/harness', '/profile'],
  },
  promptengineer: PROMPT_ENGINEER_ACCESS,
  // `aiengineer` extends `promptengineer` with the Model Execution items:
  // Semantic Functions (/functions), Workflows (/compositions), Models (/models),
  // Agents (/agents).
  aiengineer: {
    menuKeys: [
      ...PROMPT_ENGINEER_ACCESS.menuKeys,
      'model-execution',
      'functions',
      'composer',
      'models',
      'agents',
    ],
    pathPrefixes: [
      ...PROMPT_ENGINEER_ACCESS.pathPrefixes,
      '/functions',
      '/compositions',
      '/models',
      '/agents',
    ],
  },
  // `evaluator` extends `promptengineer` with the Evals items:
  // Evaluations (/evaluations), Eval Runs (/eval-runs), Human Review (/datasets).
  evaluator: {
    menuKeys: [
      ...PROMPT_ENGINEER_ACCESS.menuKeys,
      'evals',
      'evaluations',
      'eval-runs',
      'datasets',
    ],
    pathPrefixes: [
      ...PROMPT_ENGINEER_ACCESS.pathPrefixes,
      '/evaluations',
      '/eval-runs',
      '/evaluation-runs',
      '/datasets',
    ],
  },
  // Access to everything under the Knowledge Engineering menu group.
  knowledgeengineer: {
    menuKeys: [
      'home',
      'knowledge',
      'documents',
      'data-sources',
      'destinations',
      'indexes',
      'graphs',
      'transformations',
      'ragtester',
    ],
    pathPrefixes: [
      '/home',
      '/uploads',
      '/data-sources',
      '/destinations',
      '/indexes',
      '/graphs',
      '/transformations',
      '/rag',
      '/profile',
    ],
  },
};

export const isAdmin = (user) => !!user?.roles?.includes('admin');

// The restricted roles a user actually holds (roles present in the access map).
const getRestrictedRoles = (user) =>
  (user?.roles || []).filter((role) => RESTRICTED_ROLE_ACCESS[role]);

// True when the user has at least one restricted role and is NOT an admin.
// Admin wins and retains full access.
export const isRestricted = (user) =>
  !isAdmin(user) && getRestrictedRoles(user).length > 0;

// Union of allowed side-menu keys across the user's restricted roles.
export const getAllowedMenuKeys = (user) => {
  const keys = new Set();
  for (const role of getRestrictedRoles(user)) {
    for (const key of RESTRICTED_ROLE_ACCESS[role].menuKeys) {
      keys.add(key);
    }
  }
  return keys;
};

// Union of allowed path prefixes across the user's restricted roles.
const getAllowedPathPrefixes = (user) => {
  const prefixes = new Set();
  for (const role of getRestrictedRoles(user)) {
    for (const prefix of RESTRICTED_ROLE_ACCESS[role].pathPrefixes) {
      prefixes.add(prefix);
    }
  }
  return prefixes;
};

// True when a pathname is reachable by the given restricted user.
export const isPathAllowed = (user, pathname) =>
  pathname === '/' ||
  [...getAllowedPathPrefixes(user)].some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
