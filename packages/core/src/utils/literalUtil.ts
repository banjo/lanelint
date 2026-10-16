const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const key = (name: string) => (IDENTIFIER.test(name) ? name : inline(name));

const entriesOf = (value: Record<string, unknown>) =>
  Object.entries(value).filter(([, item]) => item !== undefined);

/** A value as a TypeScript literal on one line, such as `['error', { case: 'camel' }]`. */
const inline = (value: unknown): string => {
  if (typeof value === 'string') {
    return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(inline).join(', ')}]`;
  }
  if (isRecord(value)) {
    const entries = entriesOf(value);
    return entries.length
      ? `{ ${entries.map(([name, item]) => `${key(name)}: ${inline(item)}`).join(', ')} }`
      : '{}';
  }
  return String(value);
};

/**
 * A value as a TypeScript literal, split over lines when it does not fit.
 * `indent` is the indentation of the line, and `prefix` the length of the text before the value.
 */
const print = (value: unknown, indent = 0, prefix = 0, width = 80): string => {
  const flat = inline(value);
  const fits = indent + prefix + flat.length + 1 <= width;
  if (fits || !(Array.isArray(value) || isRecord(value))) {
    return flat;
  }
  const inner = ' '.repeat(indent + 2);
  const close = ' '.repeat(indent);
  if (Array.isArray(value)) {
    const items = value.map((item) => `${inner}${print(item, indent + 2, 0, width)},`);
    return `[\n${items.join('\n')}\n${close}]`;
  }
  const items = entriesOf(value).map(([name, item]) => {
    const label = `${key(name)}: `;
    return `${inner}${label}${print(item, indent + 2, label.length, width)},`;
  });
  return `{\n${items.join('\n')}\n${close}}`;
};

export const LiteralUtil = {
  inline,
  print,
};
