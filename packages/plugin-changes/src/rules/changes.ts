import { defineRule, GlobUtil } from '@pilotlint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

const globList = (description: string) =>
  v.pipe(
    v.union([v.string(), v.array(v.string())]),
    v.description(description),
    v.transform((value) => (typeof value === 'string' ? [value] : value)),
  );

const MessageSchema = v.pipe(v.string(), v.description('Replaces the finding message.'));

const HintSchema = v.pipe(
  v.string(),
  v.description('Shown under the finding as the next step, such as the command to run.'),
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
    example: [
      'error',
      {
        rules: [
          {
            when: 'src/**/messages.ts',
            require: 'src/translations/en.json',
            hint: 'Run pnpm extract-intl.',
          },
        ],
      },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      rules: v.pipe(
        v.array(
          v.object({
            when: globList('Globs of files whose change triggers the rule.'),
            require: globList('Globs of files of which at least one must change too.'),
            message: v.optional(MessageSchema),
            hint: v.optional(HintSchema),
          }),
        ),
        v.description('Files that change together.'),
      ),
    }),
  ),
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
    example: [
      'error',
      {
        rules: [
          {
            files: 'src/generated/**',
            unless: 'schema.graphql',
            hint: 'Run pnpm codegen.',
          },
        ],
      },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      rules: v.pipe(
        v.array(
          v.object({
            files: globList('Globs of generated files.'),
            unless: v.optional(
              globList(
                'Globs of generator inputs. Edits are allowed when one of them changed too.',
              ),
            ),
            message: v.optional(MessageSchema),
            hint: v.optional(HintSchema),
          }),
        ),
        v.description('Generated files.'),
      ),
    }),
  ),
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
