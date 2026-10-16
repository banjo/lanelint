import { defineRule } from '@pilotlint/core';
import * as v from 'valibot';
import { EdgeUtil } from '../utils/edgeUtil.ts';
import { SelectorListSchema } from '../models/optionSchemas.ts';
import { SelectorUtil } from '../utils/selectorUtil.ts';

export const entryOnly = defineRule({
  meta: {
    description: 'Imports from outside an element must target its entry files.',
    severity: 'error',
    docs: [
      'An element exposes its public API through its entry files (`entry` in the element',
      'definition, `index.ts` by default). Code outside the element must not reach into its',
      'other files, so the element can change its internals freely.',
      '',
      'To fix a finding, export what you need from the entry file and import it from there.',
      'Test files are skipped unless `includeTests` is set.',
    ].join('\n'),
  },
  options: v.object({
    elements: SelectorListSchema,
    includeTests: v.optional(v.boolean(), false),
    ignoreTypeImports: v.optional(v.boolean(), false),
  }),
  describe: (options) =>
    `Code outside a ${SelectorUtil.describe(options.elements)} element imports it only through its entry files.`,
  elementTypes: (options) => SelectorUtil.typesOf(options.elements),
  create: (context) => ({
    import(edge) {
      const to = EdgeUtil.internalTarget(edge);
      const element = to?.element;
      if (
        !to ||
        !element ||
        element.isEntry ||
        edge.from.element?.id === element.id ||
        EdgeUtil.skip(edge, context.options) ||
        !SelectorUtil.matches(context.options.elements, to)
      ) {
        return;
      }
      const entries = context.project.element(element.id)?.entryFiles.map((file) => file.path);
      context.report({
        at: edge,
        message: `Import ${element.root} through its entry file, not ${to.path}.`,
        hint: entries?.length
          ? `Export what you need from ${entries.join(' or ')} and import it from there.`
          : `${element.root} has no entry file yet. Create one that exports what you need.`,
      });
    },
  }),
});
