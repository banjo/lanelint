import { defineRule, GlobUtil, type AstInfo, type ModuleExport } from '@pilotlint/core';
import * as v from 'valibot';
import { CaseUtil } from '../utils/caseUtil.ts';

const isDeprecated = (ast: AstInfo, entry: ModuleExport) =>
  [entry.statementStart, entry.start].some((offset) =>
    ast
      .leadingComments(offset)
      .some((comment) => comment.type === 'Block' && comment.value.includes('@deprecated')),
  );

export const exportMatchesFilename = defineRule({
  meta: {
    description: 'A file exports one value, named after the file.',
    severity: 'error',
    docs: [
      'For example `dateUtil.ts` exports a `DateUtil` object and nothing else, so imports read',
      '`DateUtil.format()` everywhere. Type exports are allowed. With `allowDeprecated`, other',
      'values may stay while they are marked `@deprecated`, so consumers can migrate.',
      'Scope the rule to the right files with an override.',
      '',
      'To fix a finding, move the other exports into the main export, or into their own files.',
    ].join('\n'),
  },
  options: v.optional(
    v.object({
      transform: v.optional(v.picklist(['pascal', 'camel', 'none']), 'pascal'),
      allowDeprecated: v.optional(v.boolean(), false),
    }),
    {},
  ),
  describe: (options) =>
    `Each file exports one value named after the file${options.transform === 'none' ? '' : ` in ${options.transform} case`}.`,
  create: (context) => ({
    ast(file, ast) {
      const { transform, allowDeprecated } = context.options;
      const expected = transform === 'none' ? file.stem : CaseUtil.convert(file.stem, transform);
      const values = ast.module.exports.filter((entry) => !entry.typeOnly);
      if (!values.some((entry) => entry.name === expected)) {
        context.report({
          at: { path: file.path, line: 1 },
          message: `Export ${expected} from ${file.name}.`,
          key: 'missing',
        });
      }
      for (const entry of values) {
        if (entry.name === expected || (allowDeprecated && isDeprecated(ast, entry))) {
          continue;
        }
        context.report({
          at: { path: file.path, line: entry.line },
          message:
            entry.name === '*'
              ? `Do not re-export whole modules from ${file.name}; export ${expected} only.`
              : `Move ${entry.name === 'default' ? 'the default export' : entry.name} into ${expected}${allowDeprecated ? ', or mark it @deprecated while consumers migrate' : ''}.`,
        });
      }
    },
  }),
});

export const exportNamePattern = defineRule({
  meta: {
    description: 'Exported names in matching files follow a pattern.',
    severity: 'error',
    docs: [
      'For example, exports from files in `hooks/` start with `use`. Patterns are globs matched',
      'against each exported value name. Type exports and default exports are ignored.',
    ].join('\n'),
  },
  options: v.object({
    rules: v.array(
      v.object({
        files: v.union([v.string(), v.array(v.string())]),
        pattern: v.string(),
        message: v.optional(v.string()),
      }),
    ),
  }),
  describe: (options) =>
    options.rules.map(
      (rule) => `Exports from ${GlobUtil.toList(rule.files).join(', ')} are named ${rule.pattern}.`,
    ),
  create: (context) => ({
    module(file, module) {
      const rules = context.options.rules.filter((rule) => GlobUtil.matches(file.path, rule.files));
      for (const entry of module.exports) {
        if (entry.typeOnly || entry.name === 'default' || entry.name === '*') {
          continue;
        }
        const rule = rules.find((candidate) => !GlobUtil.matches(entry.name, candidate.pattern));
        if (rule) {
          context.report({
            at: { path: file.path, line: entry.line },
            message: rule.message ?? `Rename ${entry.name} to match ${rule.pattern}.`,
          });
        }
      }
    },
  }),
});
