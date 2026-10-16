import { defineRule } from '@pilotlint/core';
import * as v from 'valibot';
import { EdgeUtil } from '../utils/edgeUtil.ts';
import { SelectorListSchema } from '../models/optionSchemas.ts';
import { SelectorUtil } from '../utils/selectorUtil.ts';

const RuleSchema = v.object({
  from: SelectorListSchema,
  allow: v.optional(SelectorListSchema),
  disallow: v.optional(SelectorListSchema),
  message: v.optional(v.string()),
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
  },
  options: v.object({
    rules: v.array(RuleSchema),
    default: v.optional(v.picklist(['allow', 'disallow']), 'allow'),
    includeTests: v.optional(v.boolean(), false),
    ignoreTypeImports: v.optional(v.boolean(), false),
  }),
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
            violation.message ?? `${EdgeUtil.nameOf(from)} must not import ${EdgeUtil.nameOf(to)}.`,
          hint: 'Move the shared code to a place both may import, or invert the dependency.',
        });
      }
    },
  }),
});
