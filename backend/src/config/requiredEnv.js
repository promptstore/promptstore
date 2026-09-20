// Secrets that must come from the environment.
//
// Reading one that is unset throws instead of falling back to a baked-in
// default. A default committed to source is a published secret, and a silent
// fallback makes a misconfigured deploy indistinguishable from a correct one.
//
// Resolve lazily. `dotenv.config()` runs in the app/worker module body, which ES
// module semantics evaluate *after* every import, so a module-level read inside
// an imported file sees an unset var in dev. Call `requireEnv` at the point of
// use, and `assertRequiredEnv` once at startup (after dotenv) to fail fast.

export function requireEnv(name, hint) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.${hint ? ` ${hint}` : ''}`);
  }
  return value;
}

export function assertRequiredEnv(names) {
  const missing = Object.keys(names).filter((name) => !process.env[name]);
  if (missing.length) {
    const detail = missing.map((name) => `  ${name} - ${names[name]}`).join('\n');
    throw new Error(`Missing required environment variables:\n${detail}`);
  }
}
