import { defineRule } from '@lanelint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

export const DEFAULT_DIRECTIVES = [
  '@ts-ignore',
  '@ts-expect-error',
  '@ts-nocheck',
  'eslint-disable',
  'oxlint-disable',
  'biome-ignore',
  'istanbul ignore',
  'c8 ignore',
  'v8 ignore',
];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const noSuppressions = defineRule({
  meta: {
    description: 'No comments that switch off type checks, lint rules, or coverage.',
    severity: 'error',
    docs: [
      'Suppression comments hide problems instead of fixing them. Agents in particular tend to',
      'add them to make a check pass. The rule reads the comments of source files and finds',
      'directives such as `@ts-ignore`, `eslint-disable`, `oxlint-disable`, `biome-ignore`, and',
      'coverage ignores at the start of a comment line. Text in strings is not a comment and is',
      'never reported. Allow specific directives with `allow`.',
      '',
      'To fix a finding, fix the underlying problem and remove the comment.',
    ].join('\n'),
    example: ['error', { allow: ['@ts-expect-error'] }],
  },
  options: toStandardJsonSchema(
    v.optional(
      v.object({
        directives: v.optional(
          v.pipe(v.array(v.string()), v.description('Directives to find in comments.')),
          DEFAULT_DIRECTIVES,
        ),
        allow: v.optional(
          v.pipe(
            v.array(v.string()),
            v.description('Directives that are allowed, such as `@ts-expect-error`.'),
          ),
          [],
        ),
      }),
      {},
    ),
  ),
  describe: (options) =>
    `No ${options.directives.filter((directive) => !options.allow.includes(directive)).join(', ')} comments.`,
  create: (context) => {
    const directives = context.options.directives.filter(
      (directive) => !context.options.allow.includes(directive),
    );
    const pattern = new RegExp(`^[\\s*]*(${directives.map(escape).join('|')})(?![\\w@])`);
    return {
      ast(file, ast) {
        if (!directives.length) {
          return;
        }
        const seen = new Map<string, number>();
        for (const comment of ast.comments) {
          const firstLine = ast.lineOf(comment.start);
          comment.value.split('\n').forEach((text, offset) => {
            const directive = pattern.exec(text)?.[1];
            if (!directive) {
              return;
            }
            // Count occurrences instead of using lines, so the identity survives edits above.
            const occurrence = (seen.get(directive) ?? 0) + 1;
            seen.set(directive, occurrence);
            context.report({
              at: { path: file.path, line: firstLine + offset },
              message: `Remove the ${directive} comment and fix the problem it hides.`,
              key: `${directive}#${occurrence}`,
            });
          });
        }
      },
    };
  },
});
