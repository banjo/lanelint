import { describe, expect, it } from 'vite-plus/test';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { definePlugin, defineRule, renderRuleDocs, RULE_DOCS_MARKER } from '../src/index.ts';

const Selector = {
  title: 'Selector',
  description: 'An element type or a selector object.',
  anyOf: [
    { type: 'string' },
    { type: 'object', properties: { type: { type: 'string', description: 'Element type.' } } },
  ],
};

/** A Standard Schema with Standard JSON Schema support, as Zod, ArkType, or Valibot provide. */
const schema = (jsonSchema: Record<string, unknown>) =>
  ({
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value: unknown) => ({ value }),
      jsonSchema: { input: () => jsonSchema, output: () => jsonSchema },
    },
  }) as unknown as StandardSchemaV1<{ rules: { from: string }[] }>;

const plugin = definePlugin({
  name: 'demo',
  description: 'Demo rules.',
  rules: {
    'with-options': defineRule({
      meta: {
        description: 'A rule with options.',
        severity: 'error',
        docs: 'How to fix it.',
        example: ['error', { rules: [{ from: 'feature' }] }],
      },
      options: schema({
        type: 'object',
        properties: {
          rules: {
            type: 'array',
            description: 'The rules.',
            items: {
              type: 'object',
              properties: {
                from: { anyOf: [{ type: 'array', items: Selector }, Selector] },
                kind: { enum: ['a', 'b'], default: 'a', description: 'The kind.' },
              },
              required: ['from'],
            },
          },
        },
        required: ['rules'],
      }),
      create: () => ({}),
    }),
    'no-options': defineRule({
      meta: { description: 'A rule without options.', severity: 'warn' },
      create: () => ({}),
    }),
    'opaque-options': defineRule({
      meta: { description: 'A rule whose schema has no JSON Schema.', severity: 'error' },
      options: {
        '~standard': { version: 1, vendor: 'x', validate: (value: unknown) => ({ value }) },
      },
      create: () => ({}),
    }),
  },
});

describe('renderRuleDocs', () => {
  const files = renderRuleDocs([plugin]);
  const page = files.find((file) => file.path === 'demo.md')?.content ?? '';

  it('writes an index and one page per plugin, marked as generated', () => {
    expect(files.map((file) => file.path)).toEqual(['README.md', 'demo.md']);
    expect(files.every((file) => file.content.startsWith(RULE_DOCS_MARKER))).toBe(true);
    expect(files[0]?.content).toContain(
      '- [no-options](demo.md#no-options): A rule without options.',
    );
  });

  it('starts each page with a linked list of rules', () => {
    expect(page).toContain('| [no-options](#no-options)         | A rule without options.');
    expect(page.indexOf('[with-options](#with-options)')).toBeLessThan(
      page.indexOf('## no-options'),
    );
  });

  it('documents options as a shape and a table, with named types once', () => {
    expect(page).toContain(
      [
        '```ts',
        '{',
        '  rules: {',
        '    from: Selector[] | Selector;',
        "    kind?: 'a' | 'b';",
        '  }[];',
        '}',
        '```',
      ].join('\n'),
    );
    expect(page).toMatch(
      /\| `rules\[\]\.from` \| `Selector\[\] \\\| Selector` \| required +\| +\|/,
    );
    expect(page).toMatch(/\| `rules\[\]\.kind` \| `'a' \\\| 'b'` +\| `'a'` +\| The kind\. +\|/);
    expect(page).toContain('### Selector\n\nAn element type or a selector object.');
    expect(page).toContain('type Selector =\n  | string\n  | {\n      type?: string;\n    };');
    expect(page.match(/### Selector/g)).toHaveLength(1);
  });

  it('shows examples, and the default level for rules without options', () => {
    expect(page).toContain(
      "rules: {\n  'demo/with-options': ['error', { rules: [{ from: 'feature' }] }],\n},",
    );
    expect(page).toContain("rules: {\n  'demo/no-options': 'warn',\n},");
  });

  it('says when options cannot be shown', () => {
    expect(page).toContain('The options schema cannot be shown as JSON Schema.');
  });
});
