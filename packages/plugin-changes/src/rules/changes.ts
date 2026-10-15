import { defineRule, GlobUtil } from '@archlint/core';
import * as v from 'valibot';

const GlobListSchema = v.pipe(
  v.union([v.string(), v.array(v.string())]),
  v.transform((value) => (typeof value === 'string' ? [value] : value)),
);

const list = (paths: readonly string[]) =>
  paths.length > 3
    ? `${paths.slice(0, 3).join(', ')} and ${paths.length - 3} more`
    : paths.join(', ');

export const requiresChange = defineRule({
  meta: {
    description: 'Files that must change together.',
    severity: 'error',
    docs: [
      'When a file matching `when` changes compared with the base ref, a file matching `require`',
      'must change too. Examples: translations when messages change, a changeset when a package',
      'changes, generated types when a schema changes. Uses git; run with `--base` in CI.',
      '',
      'To fix a finding, make the required change, usually by running the command in the hint.',
    ].join('\n'),
  },
  options: v.object({
    rules: v.array(
      v.object({
        when: GlobListSchema,
        require: GlobListSchema,
        message: v.optional(v.string()),
        hint: v.optional(v.string()),
      }),
    ),
  }),
  describe: (options) =>
    options.rules.map(
      (rule) =>
        `When ${rule.when.join(', ')} changes, ${rule.require.join(', ')} changes too.${rule.hint ? ` ${rule.hint}` : ''}`,
    ),
  create: (context) => ({
    project() {
      for (const rule of context.options.rules) {
        const triggers = context.changes.matching(rule.when).map((change) => change.path);
        const [first, ...rest] = triggers;
        if (!first || context.changes.matching(rule.require).length) {
          continue;
        }
        context.report({
          at: { path: first },
          message:
            rule.message ??
            `${list(triggers)} changed, but nothing matching ${rule.require.join(', ')} did.`,
          hint: rule.hint,
          key: `requires:${rule.require.join(',')}`,
          related: rest.map((path) => ({ path })),
        });
      }
    },
  }),
});

export const noManualEdit = defineRule({
  meta: {
    description: 'Generated files must be regenerated, not edited by hand.',
    severity: 'error',
    docs: [
      'Files matching `files` are produced by a tool. A change to them is reported unless a file',
      'matching `unless` (the tool input, such as a schema) changed too. Uses git.',
      '',
      'To fix a finding, revert the edit and run the generator instead.',
    ].join('\n'),
  },
  options: v.object({
    rules: v.array(
      v.object({
        files: GlobListSchema,
        unless: v.optional(GlobListSchema),
        message: v.optional(v.string()),
        hint: v.optional(v.string()),
      }),
    ),
  }),
  describe: (options) =>
    options.rules.map(
      (rule) =>
        `${rule.files.join(', ')} are generated and not edited by hand.${rule.hint ? ` ${rule.hint}` : ''}`,
    ),
  create: (context) => ({
    project() {
      for (const rule of context.options.rules) {
        if (rule.unless && context.changes.matching(rule.unless).length) {
          continue;
        }
        for (const change of context.changes.files) {
          if (change.status === 'deleted' || !GlobUtil.matches(change.path, rule.files)) {
            continue;
          }
          context.report({
            at: { path: change.path },
            message: rule.message ?? `${change.path} is generated and must not be edited by hand.`,
            hint: rule.hint ?? 'Revert the edit and run the generator instead.',
          });
        }
      }
    },
  }),
});
