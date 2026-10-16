import { defineRule, GlobUtil } from '@pilotlint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { EdgeUtil } from '../utils/edgeUtil.ts';
import { HintSchema, ReasonSchema, SelectorListSchema } from '../models/optionSchemas.ts';
import { SelectorUtil } from '../utils/selectorUtil.ts';

const RestrictionSchema = v.object({
  name: v.pipe(
    v.string(),
    v.description('Package name or glob, such as `@mui/material`, `lodash*`, or `node:fs`.'),
  ),
  importNames: v.optional(
    v.pipe(
      v.array(v.string()),
      v.description('Only these imported names are restricted. Defaults to the whole package.'),
    ),
  ),
  allowTypeImports: v.optional(
    v.pipe(v.boolean(), v.description('Allow imports that only import types.')),
    false,
  ),
  from: v.optional(
    v.pipe(
      SelectorListSchema,
      v.description('Files the restriction applies to. Defaults to every file.'),
    ),
  ),
  message: v.optional(ReasonSchema),
  hint: v.optional(HintSchema),
});

export const restrictedPackages = defineRule({
  meta: {
    description: 'Packages, or names from packages, that must not be imported.',
    severity: 'error',
    docs: [
      'Restrictions keep code on the libraries the project has chosen, for example the design',
      'system instead of a component library it wraps, or away from a library being phased out.',
      'A restriction can cover a whole package, some names from it, or only some elements.',
      'Node builtins are matched as `node:<name>`, for example to keep `node:fs` out of pure code.',
      '',
      'To fix a finding, use the alternative named in the message.',
    ].join('\n'),
    example: [
      'error',
      {
        packages: [
          {
            name: '@mui/material',
            importNames: ['Button'],
            message: 'Use the design system instead.',
            hint: 'Import Button from @acme/design-system.',
          },
          { name: 'node:{fs,child_process}', from: { files: '**/utils/**' } },
        ],
      },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      packages: v.pipe(v.array(RestrictionSchema), v.description('The restricted packages.')),
    }),
  ),
  describe: (options) =>
    options.packages.map((restriction) => {
      const what = restriction.importNames
        ? `${restriction.importNames.join(', ')} from ${restriction.name}`
        : restriction.name;
      const where = restriction.from ? ` in ${SelectorUtil.describe(restriction.from)}` : '';
      return `Do not import ${what}${where}.${restriction.message ? ` ${restriction.message}` : ''}`;
    }),
  elementTypes: (options) =>
    options.packages.flatMap((restriction) => SelectorUtil.typesOf(restriction.from)),
  create: (context) => ({
    import(edge) {
      const name =
        edge.target.type === 'builtin'
          ? `node:${edge.target.module}`
          : edge.target.type === 'external'
            ? edge.target.package
            : EdgeUtil.packageNameOf(edge.specifier);
      if (!name) {
        return;
      }
      for (const restriction of context.options.packages) {
        if (restriction.name !== name && !GlobUtil.matches(name, restriction.name)) {
          continue;
        }
        if (
          (edge.typeOnly && restriction.allowTypeImports) ||
          (restriction.from && !SelectorUtil.matches(restriction.from, edge.from))
        ) {
          continue;
        }
        const names = restriction.importNames
          ? edge.names.filter((imported) => restriction.importNames?.includes(imported))
          : [];
        if (restriction.importNames && !names.length) {
          continue;
        }
        const what = names.length ? `${names.join(', ')} from ${name}` : name;
        context.report({
          at: edge,
          message: `Do not import ${what}.${restriction.message ? ` ${restriction.message}` : ''}`,
          hint: restriction.hint,
          key: `${restriction.name}:${what}`,
        });
        return;
      }
    },
  }),
});
