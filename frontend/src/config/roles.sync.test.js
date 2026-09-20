// Drift guard between frontend/src/config/roles.js and
// backend/src/config/roles.js. Webpack cannot import across src/, but Jest
// runs in Node, so the backend config is read from disk as text.
import fs from 'fs';
import path from 'path';

import {
  DEFAULT_ROLE,
  RESTRICTED_ROLE_ACCESS,
  ROLE_MAP_VERSION,
  ROLE_OPTIONS,
} from './roles';

const backendSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/src/config/roles.js'),
  'utf8'
);

const parseArray = (name) => {
  const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`).exec(backendSrc);
  if (!m) throw new Error(`${name} not found in backend/src/config/roles.js`);
  return (m[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
};

test('role names match between frontend and backend', () => {
  expect(parseArray('ROLES').sort()).toEqual(ROLE_OPTIONS.map((o) => o.value).sort());
});

test('role map versions match', () => {
  const m = /ROLE_MAP_VERSION = (\d+)/.exec(backendSrc);
  expect(m).not.toBeNull();
  expect(Number(m[1])).toBe(ROLE_MAP_VERSION);
});

test('default role matches', () => {
  const m = /DEFAULT_ROLE = '([^']+)'/.exec(backendSrc);
  expect(m).not.toBeNull();
  expect(m[1]).toBe(DEFAULT_ROLE);
});

test('the default role is assignable', () => {
  expect(ROLE_OPTIONS.map((o) => o.value)).toContain(DEFAULT_ROLE);
});

test('every restricted frontend role has a backend API grant list', () => {
  const m = /export const ROLE_API_ACCESS = \{([\s\S]*?)\n\};/.exec(backendSrc);
  expect(m).not.toBeNull();
  for (const role of Object.keys(RESTRICTED_ROLE_ACCESS)) {
    expect(m[1]).toContain(`${role}:`);
  }
});
