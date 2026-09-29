import type Anthropic from "@anthropic-ai/sdk";

// Model tool output is only *asked* to follow the tool's input_schema, not
// guaranteed to: a field can come back as the wrong type ("4" for 4, one
// string instead of an array), outside its enum, or missing. Anything that
// flows from there into the saved trip and isn't what the UI expects crashes
// it on the next render — and keeps crashing, because the trip is persisted.
//
// So every tool input is conformed to its own schema before use: harmless
// mismatches are coerced, invalid optional fields and array items are
// dropped, and a missing or invalid required field rejects the whole input.
// Supports the JSON Schema subset our tool schemas use: object (properties,
// required), array (items, maxItems), string (enum, pattern, maxLength),
// number/integer (enum, minimum, maximum) and boolean.

export interface JsonSchema {
  type?: string;
  enum?: readonly unknown[];
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  maxLength?: number;
}

const INVALID = Symbol("invalid");
type Result = unknown | typeof INVALID;

// Hard ceilings regardless of schema, so a runaway response can't bloat the trip.
const DEFAULT_MAX_ITEMS = 200;
const DEFAULT_MAX_STRING = 5_000;

function conform(value: unknown, schema: JsonSchema): Result {
  switch (schema.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return INVALID;
      const input = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        if (input[key] === undefined || input[key] === null) continue;
        const v = conform(input[key], propSchema);
        if (v !== INVALID) out[key] = v;
      }
      for (const key of schema.required ?? []) if (!(key in out)) return INVALID;
      return out;
    }
    case "array": {
      // A lone value where a list was expected is almost always a list of one.
      const list = Array.isArray(value) ? value : [value];
      const items = schema.items ?? {};
      const kept = list
        .map((item) => conform(item, items))
        .filter((item) => item !== INVALID)
        .slice(0, schema.maxItems ?? DEFAULT_MAX_ITEMS);
      // A list whose every item was invalid is unusable, not empty: many
      // updates are full replacements, so [] would wipe the traveller's
      // existing selection. A genuinely empty list is still accepted.
      return list.length > 0 && kept.length === 0 ? INVALID : kept;
    }
    case "string": {
      if (typeof value !== "string" && typeof value !== "number") return INVALID;
      const s = String(value).trim();
      if (schema.enum && !schema.enum.includes(s)) return INVALID;
      if (schema.pattern && !new RegExp(schema.pattern).test(s)) return INVALID;
      return s.slice(0, schema.maxLength ?? DEFAULT_MAX_STRING);
    }
    case "number":
    case "integer": {
      const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
      if (typeof n !== "number" || !Number.isFinite(n)) return INVALID;
      if (schema.type === "integer" && !Number.isInteger(n)) return INVALID;
      if (schema.enum && !schema.enum.includes(n)) return INVALID;
      if (schema.minimum !== undefined && n < schema.minimum) return INVALID;
      if (schema.maximum !== undefined && n > schema.maximum) return INVALID;
      return n;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (value === "true" || value === "false") return value === "true";
      return INVALID;
    }
    default:
      return value;
  }
}

/**
 * The tool's input conformed to its own input_schema, or null if a required
 * field is missing or unusable. Typed by the caller, which is then true.
 */
export function parseToolInput<T>(tool: Anthropic.Tool, input: unknown): T | null {
  const result = conform(input, tool.input_schema as JsonSchema);
  return result === INVALID ? null : (result as T);
}

/**
 * Any JSON input conformed to `schema` with the same rules — also used to
 * validate API request bodies (see the search routes).
 */
export function parseWithSchema<T>(schema: JsonSchema, input: unknown): T | null {
  const result = conform(input, schema);
  return result === INVALID ? null : (result as T);
}

/** The first tool_use block for `tool` in a response, conformed to its schema. */
export function findToolInput<T>(content: Anthropic.ContentBlock[], tool: Anthropic.Tool): T | null {
  const block = content.find((b) => b.type === "tool_use" && b.name === tool.name);
  return block && block.type === "tool_use" ? parseToolInput<T>(tool, block.input) : null;
}
