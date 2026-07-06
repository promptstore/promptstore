// Feature flags. All features are OFF by default and only enabled when the
// corresponding env var is set to the string 'true'. Env vars must be
// referenced literally (not via process.env[name]) because Create React App
// inlines them at build time.
export const FEATURES = {
  apps: process.env.REACT_APP_FEATURE_APPS === 'true',
  imagegen: process.env.REACT_APP_FEATURE_IMAGEGEN === 'true',
  agentNetworks: process.env.REACT_APP_FEATURE_AGENT_NETWORKS === 'true',
  guardrails: process.env.REACT_APP_FEATURE_GUARDRAILS === 'true',
  backgroundJobs: process.env.REACT_APP_FEATURE_BACKGROUND_JOBS === 'true',
  monitoring: process.env.REACT_APP_FEATURE_MONITORING === 'true',
  support: process.env.REACT_APP_FEATURE_SUPPORT === 'true',
};

export const isFeatureEnabled = (name) => !!FEATURES[name];

// Side-menu item keys owned by each feature. Group keys (e.g. `guardrails`,
// `support`) remove the whole group when the feature is off.
const FEATURE_MENU_KEYS = {
  apps: ['apps'],
  imagegen: ['imagegen'],
  agentNetworks: ['agent-networks'],
  guardrails: ['guardrails'],
  backgroundJobs: ['background-jobs'],
  monitoring: ['monitoring'],
  support: ['support'],
};

// Route path prefixes owned by each feature (only features with internal
// routes; Background Jobs, Monitoring and Support are external links).
const FEATURE_PATH_PREFIXES = {
  apps: ['/apps', '/apps-edit'],
  imagegen: ['/imagegen'],
  agentNetworks: ['/agent-networks'],
  guardrails: ['/rules'],
};

// Set of side-menu keys to hide because their feature is disabled.
export const getDisabledMenuKeys = () => {
  const keys = new Set();
  for (const [feature, menuKeys] of Object.entries(FEATURE_MENU_KEYS)) {
    if (!FEATURES[feature]) {
      menuKeys.forEach((key) => keys.add(key));
    }
  }
  return keys;
};

const matchesPrefix = (pathname, prefix) =>
  pathname === prefix || pathname.startsWith(prefix + '/');

// True when a pathname belongs to a feature that is currently disabled.
export const isPathFeatureDisabled = (pathname) =>
  Object.entries(FEATURE_PATH_PREFIXES).some(
    ([feature, prefixes]) =>
      !FEATURES[feature] && prefixes.some((prefix) => matchesPrefix(pathname, prefix))
  );
