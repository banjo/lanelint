import { defineRule, GlobUtil } from '@pilotlint/core';
import * as v from 'valibot';
import { EdgeUtil } from '../utils/edgeUtil.ts';
import { SelectorListSchema } from '../models/optionSchemas.ts';
import { SelectorUtil } from '../utils/selectorUtil.ts';

const RestrictionSchema = v.object({
  /** Package name or glob, for example `@mui/material`, `lodash*`, or `node:fs`. */
  name: v.string(),
  importNames: v.optional(v.array(v.string())),
  allowTypeImports: v.optional(v.boolean(), false),
  from: v.optional(SelectorListSchema),
  message: v.optional(v.string()),
  hint: v.optional(v.string()),
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
  },
  options: v.object({ packages: v.array(RestrictionSchema) }),
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
