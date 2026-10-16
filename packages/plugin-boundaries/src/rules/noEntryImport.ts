import { defineRule } from '@pilotlint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { EdgeUtil } from '../utils/edgeUtil.ts';
import { IncludeTestsSchema, MessageSchema, SelectorListSchema } from '../models/optionSchemas.ts';
import { SelectorUtil } from '../utils/selectorUtil.ts';

export const noEntryImport = defineRule({
  meta: {
    description: 'Imports must target the files they need, not entry files.',
    severity: 'error',
    docs: [
      'Entry files often load a whole element, including UI and hooks. Some code must import',
      'the specific files it needs instead: code inside an element importing its own entry',
      '(`to: "self"`), or elements that only need a model or helper from another element.',
      '',
      'To fix a finding, import the file that defines what you use.',
    ].join('\n'),
    example: [
      'error',
      {
        rules: [
          { from: 'feature', to: 'self' },
          { from: 'common', to: 'common', message: 'Import only the files you need.' },
        ],
      },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      rules: v.array(
        v.object({
          from: v.pipe(SelectorListSchema, v.description('Files whose imports this rule checks.')),
          to: v.pipe(
            v.union([v.literal('self'), SelectorListSchema]),
            v.description(
              'Elements whose entry files must not be imported, or `self` for the element of the importing file.',
            ),
          ),
          message: v.optional(MessageSchema),
        }),
      ),
      includeTests: IncludeTestsSchema,
    }),
  ),
  describe: (options) =>
    options.rules.map((rule) =>
      rule.to === 'self'
        ? `${SelectorUtil.describe(rule.from)} imports its own files directly, not its own entry file.`
        : `${SelectorUtil.describe(rule.from)} imports the files it needs from ${SelectorUtil.describe(rule.to)}, not their entry files.`,
    ),
  elementTypes: (options) =>
    options.rules.flatMap((rule) => [
      ...SelectorUtil.typesOf(rule.from),
      ...(rule.to === 'self' ? [] : SelectorUtil.typesOf(rule.to)),
    ]),
  create: (context) => ({
    import(edge) {
      const to = EdgeUtil.internalTarget(edge);
      const element = to?.element;
      if (!to || !element?.isEntry || EdgeUtil.skip(edge, context.options)) {
        return;
      }
      const self = edge.from.element?.id === element.id;
      const rule = context.options.rules.find(
        (candidate) =>
          SelectorUtil.matches(candidate.from, edge.from) &&
          (candidate.to === 'self' ? self : !self && SelectorUtil.matches(candidate.to, to)),
      );
      if (!rule) {
        return;
      }
      context.report({
        at: edge,
        message:
          rule.message ??
          (self
            ? `Import files of ${element.root} directly, not its own entry file ${to.path}.`
            : `Import the file you need from ${element.root}, not its entry file ${to.path}.`),
        hint: 'Import the file that defines what you use.',
      });
    },
  }),
});
