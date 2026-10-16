import { JSON_SCHEMA_LIBRARY_OPTIONS } from '../constants/defaults.ts';
import { LiteralUtil } from './literalUtil.ts';

export type JsonSchema = Readonly<Record<string, unknown>>;

/** Types with a name, by name. Filled while rendering, so they can be documented once. */
export type NamedTypes = Map<string, JsonSchema>;

export interface SchemaContext {
  readonly root: JsonSchema;
  readonly named: NamedTypes;
}

export interface SchemaRow {
  /** Path of the option, such as `rules[].from`. */
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly hasDefault: boolean;
  readonly default: unknown;
  readonly description: string | undefined;
}

const isSchema = (value: unknown): value is JsonSchema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const schemasOf = (value: unknown): JsonSchema[] =>
  Array.isArray(value) ? value.filter(isSchema) : [];

/** The input JSON Schema of a Standard JSON Schema, or `undefined` when it is not one or fails. */
const fromStandard = (schema: unknown): JsonSchema | undefined => {
  const standard = isSchema(schema) ? schema['~standard'] : undefined;
  if (!isSchema(standard) || !isSchema(standard.jsonSchema)) {
    return undefined;
  }
  const input: unknown = standard.jsonSchema.input;
  if (typeof input !== 'function') {
    return undefined;
  }
  const vendor = typeof standard.vendor === 'string' ? standard.vendor : '';
  try {
    const result: unknown = input({
      target: 'draft-2020-12',
      libraryOptions: JSON_SCHEMA_LIBRARY_OPTIONS[vendor],
    });
    return isSchema(result) ? result : undefined;
  } catch {
    return undefined;
  }
};

const resolveRef = (ref: string, context: SchemaContext): [string, JsonSchema] | undefined => {
  const match = /^#\/(?:\$defs|definitions)\/(.+)$/.exec(ref);
  const name = match?.[1];
  const definitions = context.root.$defs ?? context.root.definitions;
  const target = name && isSchema(definitions) ? definitions[name] : undefined;
  return name && isSchema(target) ? [name, target] : undefined;
};

/** The name of a referenced or titled schema, registered in the context. */
const nameOf = (schema: JsonSchema, context: SchemaContext): string | undefined => {
  if (typeof schema.$ref === 'string') {
    const resolved = resolveRef(schema.$ref, context);
    if (!resolved) {
      return 'unknown';
    }
    const [name, target] = resolved;
    const title = typeof target.title === 'string' ? target.title : name;
    if (!context.named.has(title)) {
      context.named.set(title, target);
    }
    return title;
  }
  if (typeof schema.title === 'string') {
    if (!context.named.has(schema.title)) {
      context.named.set(schema.title, schema);
    }
    return schema.title;
  }
  return undefined;
};

const isNamed = (schema: JsonSchema) =>
  typeof schema.$ref === 'string' || typeof schema.title === 'string';

/** Properties of an object schema, with whether each is required. */
const propertiesOf = (schema: JsonSchema): [string, JsonSchema, boolean][] => {
  if (!isSchema(schema.properties)) {
    return [];
  }
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  return Object.entries(schema.properties)
    .filter((entry): entry is [string, JsonSchema] => isSchema(entry[1]))
    .map(([name, property]) => [name, property, required.has(name)]);
};

const isInlineObject = (schema: JsonSchema) => !isNamed(schema) && propertiesOf(schema).length > 0;

const unionMembers = (schema: JsonSchema) => schemasOf(schema.anyOf ?? schema.oneOf);

const isUnion = (schema: JsonSchema) =>
  !isNamed(schema) &&
  (unionMembers(schema).length > 1 ||
    (Array.isArray(schema.enum) && schema.enum.length > 1) ||
    (Array.isArray(schema.type) && schema.type.length > 1));

const key = (name: string) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : LiteralUtil.inline(name));

/** A TypeScript-like type on one line. With `self`, the schema's own name is not used. */
const typeOf = (schema: JsonSchema, context: SchemaContext, self = false): string => {
  const name = self ? undefined : nameOf(schema, context);
  if (name) {
    return name;
  }
  const wrap = (member: JsonSchema) => {
    const type = typeOf(member, context);
    return isUnion(member) ? `(${type})` : type;
  };
  if ('const' in schema) {
    return LiteralUtil.inline(schema.const);
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => LiteralUtil.inline(value)).join(' | ');
  }
  const members = unionMembers(schema);
  if (members.length) {
    return [...new Set(members.map((member) => typeOf(member, context)))].join(' | ');
  }
  const all = schemasOf(schema.allOf);
  if (all.length) {
    return all.map(wrap).join(' & ');
  }
  if (Array.isArray(schema.type)) {
    return schema.type
      .map((type: unknown) => typeOf({ ...schema, type, title: undefined }, context, true))
      .join(' | ');
  }
  switch (schema.type) {
    case 'string':
    case 'boolean':
    case 'null':
      return schema.type;
    case 'number':
    case 'integer':
      return 'number';
    case 'array': {
      const tuple = schemasOf(schema.prefixItems);
      if (tuple.length) {
        return `[${tuple.map((item) => typeOf(item, context)).join(', ')}]`;
      }
      return isSchema(schema.items) ? `${wrap(schema.items)}[]` : 'unknown[]';
    }
    default:
      break;
  }
  const properties = propertiesOf(schema);
  if (properties.length) {
    const fields = properties.map(
      ([property, value, required]) =>
        `${key(property)}${required ? '' : '?'}: ${typeOf(value, context)}`,
    );
    return `{ ${fields.join('; ')} }`;
  }
  if (isSchema(schema.additionalProperties)) {
    return `Record<string, ${typeOf(schema.additionalProperties, context)}>`;
  }
  return schema.type === 'object' ? 'object' : 'unknown';
};

/**
 * A TypeScript-like type over several lines, with one line per property.
 * With `self`, the schema's own name is not used, and a union with objects gets one line per member.
 */
const declaration = (
  schema: JsonSchema,
  context: SchemaContext,
  indent = 0,
  self = false,
): string => {
  if (!self && isNamed(schema)) {
    return typeOf(schema, context);
  }
  const properties = propertiesOf(schema);
  if (properties.length) {
    const inner = ' '.repeat(indent + 2);
    const fields = properties.map(
      ([property, value, required]) =>
        `${inner}${key(property)}${required ? '' : '?'}: ${declaration(value, context, indent + 2)};`,
    );
    return `{\n${fields.join('\n')}\n${' '.repeat(indent)}}`;
  }
  if (schema.type === 'array' && isSchema(schema.items) && isInlineObject(schema.items)) {
    return `${declaration(schema.items, context, indent)}[]`;
  }
  const members = unionMembers(schema);
  if (self && members.some(isInlineObject)) {
    const lines = members.map(
      (member) => `${' '.repeat(indent + 2)}| ${declaration(member, context, indent + 4)}`,
    );
    return `\n${lines.join('\n')}`;
  }
  return typeOf(schema, context, self);
};

/** One row per option, including the options of nested objects, such as `rules[].from`. */
const rowsOf = (schema: JsonSchema, context: SchemaContext, prefix = ''): SchemaRow[] =>
  propertiesOf(schema).flatMap(([property, value, required]) => {
    const name = `${prefix}${property}`;
    const items = value.type === 'array' && isSchema(value.items) ? value.items : undefined;
    const nested = isInlineObject(value)
      ? value
      : items && isInlineObject(items)
        ? items
        : undefined;
    const type = !nested ? typeOf(value, context) : nested === value ? 'object' : 'object[]';
    const row: SchemaRow = {
      name,
      type,
      required,
      hasDefault: 'default' in value,
      default: value.default,
      description: typeof value.description === 'string' ? value.description : undefined,
    };
    return nested
      ? [row, ...rowsOf(nested, context, `${name}${nested === value ? '.' : '[].'}`)]
      : [row];
  });

/** Rows for a named type: its properties, or the properties of the objects in its union. */
const typeRowsOf = (schema: JsonSchema, context: SchemaContext): SchemaRow[] => {
  const members = unionMembers(schema).filter(isInlineObject);
  return members.length
    ? members.flatMap((member) => rowsOf(member, context))
    : rowsOf(schema, context);
};

export const JsonSchemaUtil = {
  declaration,
  fromStandard,
  rowsOf,
  typeOf,
  typeRowsOf,
};
