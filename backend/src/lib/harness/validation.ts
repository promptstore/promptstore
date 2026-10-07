import Ajv from 'ajv';

import type { HarnessTool, ToolCall } from './types';

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: true,
  useDefaults: true,
  strict: false,
});

const cache = new WeakMap<object, any>();

function getValidator(schema: Record<string, any>) {
  let validate = cache.get(schema);
  if (!validate) {
    validate = ajv.compile(schema);
    cache.set(schema, validate);
  }
  return validate;
}

/**
 * Validate (and coerce) tool-call arguments against the tool's JSON Schema.
 * Returns the coerced arguments, or throws an error whose message is meant to
 * be fed back to the model so it can correct the call.
 */
export function validateToolArguments(tool: HarnessTool, toolCall: ToolCall): any {
  const args = structuredClone(toolCall.arguments ?? {});
  // models often send null for optional fields
  for (const [k, v] of Object.entries(args)) {
    if (v === null) delete args[k];
  }
  if (!tool.parameters || !Object.keys(tool.parameters).length) {
    return args;
  }
  const validate = getValidator(tool.parameters);
  if (!validate(args)) {
    const errors = (validate.errors || [])
      .map((e: any) => `  - ${e.instancePath || '/'}: ${e.message}`)
      .join('\n');
    throw new Error(
      `Validation failed for tool "${tool.name}":\n${errors}\n\n` +
      `Received arguments:\n${JSON.stringify(toolCall.arguments, null, 2)}`
    );
  }
  return args;
}
