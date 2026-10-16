import { defineRule, GlobUtil } from '@pilotlint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

export const noUnresolved = defineRule({
  meta: {
    description: 'Imports must resolve to a file or an installed package.',
    severity: 'error',
    docs: [
      'An import that cannot be resolved usually points at a moved or deleted file, a typo, or a',
      'package that is not installed. Resolution follows the nearest tsconfig.json, including',
      '`paths`. Imports of files excluded from the project are not reported.',
      '',
      'To fix a finding, correct the path, or install the missing package.',
    ].join('\n'),
    example: ['error', { ignore: ['virtual:*', '*.svg?react'] }],
  },
  options: toStandardJsonSchema(
    v.optional(
      v.object({
        ignore: v.optional(
          v.pipe(
            v.array(v.string()),
            v.description(
              'Globs of import specifiers that are never reported, such as `virtual:*`.',
            ),
          ),
          [],
        ),
      }),
      {},
    ),
  ),
  create: (context) => ({
    import(edge) {
      if (
        edge.target.type !== 'unresolved' ||
        GlobUtil.matches(edge.specifier, context.options.ignore)
      ) {
        return;
      }
      context.report({
        at: edge,
        message: `Cannot resolve "${edge.specifier}".`,
        hint: 'Fix the import path, or install the package if it is missing.',
      });
    },
  }),
});
