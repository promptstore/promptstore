// The Home dashboard hides stat cards a role cannot open. Each statistic key
// from GET /api/workspaces/:id/statistics is a route segment, so the card's
// visibility is exactly isPathVisible(user, `/${key}`).
import { isPathVisible } from './roles';

// Keys as returned by backend/src/routes/home.js.
const STAT_KEYS = ['agents', 'data-sources', 'functions', 'indexes', 'graphs',
                   'models', 'prompt-sets', 'rules', 'transformations'];

const visible = (roles) => STAT_KEYS.filter((k) => isPathVisible({ roles }, `/${k}`));

test('promptengineer sees only prompt templates', () => {
  expect(visible(['promptengineer'])).toEqual(['prompt-sets']);
});

test('aiengineer sees the model-execution cards too', () => {
  expect(visible(['aiengineer']).sort())
    .toEqual(['agents', 'functions', 'models', 'prompt-sets'].sort());
});

test('evaluator sees prompt templates only among these keys', () => {
  expect(visible(['evaluator'])).toEqual(['prompt-sets']);
});

test('knowledgeengineer sees the knowledge cards', () => {
  expect(visible(['knowledgeengineer']).sort())
    .toEqual(['data-sources', 'graphs', 'indexes', 'transformations'].sort());
});

test('ops sees only prompt templates', () => {
  expect(visible(['ops'])).toEqual(['prompt-sets']);
});

test('multiple roles union their cards', () => {
  expect(visible(['promptengineer', 'knowledgeengineer']).sort())
    .toEqual(['data-sources', 'graphs', 'indexes', 'prompt-sets', 'transformations'].sort());
});

test('admin sees every card whose feature is enabled', () => {
  // `rules` belongs to the guardrails feature, which is off by default, so it
  // is hidden even from an admin - matching the side menu.
  expect(visible(['admin'])).toEqual(STAT_KEYS.filter((k) => k !== 'rules'));
});

test('rulesets card is hidden while the guardrails feature is off', () => {
  expect(visible(['admin'])).not.toContain('rules');
  expect(visible(['aiengineer'])).not.toContain('rules');
});

test('My Workspaces / My Apps follow the same rule', () => {
  expect(isPathVisible({ roles: ['admin'] }, '/workspaces')).toBe(true);
  expect(isPathVisible({ roles: ['promptengineer'] }, '/workspaces')).toBe(false);
  // Apps is feature-flagged off by default, so hidden even for an admin.
  expect(isPathVisible({ roles: ['admin'] }, '/apps')).toBe(false);
});
