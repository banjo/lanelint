import { defineRule } from '@pilotlint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { EdgeUtil } from '../utils/edgeUtil.ts';
import {
  IgnoreTypeImportsSchema,
  IncludeTestsSchema,
  MessageSchema,
  SelectorListSchema,
} from '../models/optionSchemas.ts';
import { SelectorUtil } from '../utils/selectorUtil.ts';

const RuleSchema = v.object({
  from: v.pipe(SelectorListSchema, v.description('Files whose imports this rule checks.')),
  allow: v.optional(
    v.pipe(
      SelectorListSchema,
      v.description('The only targets these files may import, besides their own element.'),
    ),
  ),
  disallow: v.optional(
    v.pipe(SelectorListSchema, v.description('Targets these files must not import.')),
  ),
  message: v.optional(MessageSchema),
});

export const allowedImports = defineRule({
  meta: {
    description: 'Controls which elements may import which.',
    severity: 'error',
    docs: [
      'Each rule matches the importing file with `from`. A target that matches `disallow` is',
      'reported. When a matching rule has `allow`, targets that match no `allow` list are reported.',
      'Otherwise `default` decides: `allow` (the default) or `disallow`. Imports inside one element',
      'are always allowed. Selectors are element types, or `{ type, captures, files }`.',
      '',
      'To fix a finding, move the shared code to a place both sides may import, or invert the',
      'dependency so the lower-level code does not know about the higher-level code.',
    ].join('\n'),
    example: [
      'error',
      {
        rules: [
          { from: 'feature', allow: ['common', 'shared'] },
          { from: 'common', disallow: 'feature', message: 'Common code must not know features.' },
        ],
      },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      rules: v.pipe(v.array(RuleSchema), v.description('Rules, checked in order.')),
      default: v.optional(
        v.pipe(
          v.picklist(['allow', 'disallow']),
          v.description('Whether imports between elements that no rule mentions are allowed.'),
        ),
        'allow',
      ),
      includeTests: IncludeTestsSchema,
      ignoreTypeImports: IgnoreTypeImportsSchema,
    }),
  ),
  describe: (options) => [
    ...options.rules.flatMap((rule) => {
      const from = SelectorUtil.describe(rule.from);
      return [
        ...(rule.allow ? [`${from} may import only ${SelectorUtil.describe(rule.allow)}.`] : []),
        ...(rule.disallow
          ? [`${from} must not import ${SelectorUtil.describe(rule.disallow)}.`]
          : []),
      ];
    }),
    ...(options.default === 'disallow'
      ? ['Imports between elements that no rule allows are not allowed.']
      : []),
  ],
  elementTypes: (options) =>
    options.rules.flatMap((rule) => [
      ...SelectorUtil.typesOf(rule.from),
      ...SelectorUtil.typesOf(rule.allow),
      ...SelectorUtil.typesOf(rule.disallow),
    ]),
  create: (context) => ({
    import(edge) {
      const to = EdgeUtil.internalTarget(edge);
      const from = edge.from;
      if (!to || EdgeUtil.skip(edge, context.options)) {
        return;
      }
      if (from.element?.id === to.element?.id && (from.element || to.element)) {
        return;
      }
      const matching = context.options.rules.filter((rule) =>
        SelectorUtil.matches(rule.from, from),
      );
      const denied = matching.find(
        (rule) => rule.disallow && SelectorUtil.matches(rule.disallow, to),
      );
      const allowLists = matching.filter((rule) => rule.allow);
      const allowed = allowLists.some((rule) => rule.allow && SelectorUtil.matches(rule.allow, to));
      const violation =
        denied ??
        (allowLists.length
          ? allowed
            ? undefined
            : allowLists[0]
          : context.options.default === 'disallow' && (from.element || to.element)
            ? { message: undefined }
            : undefined);
      if (violation) {
        context.report({
          at: edge,
          message:
            violation.message ??
            `${EdgeUtil.nameOf(from, true)} must not import ${EdgeUtil.nameOf(to)}.`,
          hint: 'Move the shared code to a place both may import, or invert the dependency.',
        });
      }
    },
  }),
});
