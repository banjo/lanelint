import { defineRule, GlobUtil } from '@archlint/core';
import * as v from 'valibot';

export const rootOnlyFiles = defineRule({
  meta: {
    description: 'Some files may only exist at the root of an element.',
    severity: 'error',
    docs: [
      'Files such as barrels (`index.ts`) or message catalogs belong at the root of an element,',
      'so each element has one of them. Names are globs matched against the file name.',
      '',
      'To fix a finding, merge the file into the one at the element root.',
    ].join('\n'),
  },
  options: v.object({ names: v.array(v.string()) }),
  describe: (options) => `${options.names.join(', ')} only exist at the root of an element.`,
  create: (context) => ({
    file(file) {
      const element = file.element;
      if (
        !element?.relativePath.includes('/') ||
        !GlobUtil.matches(file.name, context.options.names)
      ) {
        return;
      }
      context.report({
        at: file,
        message: `${file.name} belongs only at the root of ${element.root}.`,
        hint: `Move its contents into ${element.root}/${file.name}.`,
      });
    },
  }),
});

export const fileNamePattern = defineRule({
  meta: {
    description: 'Files in some directories must match a name pattern.',
    severity: 'error',
    docs: [
      'Each rule matches the parent directory by name, or by path when `directory` contains `/`,',
      'and requires file names in it to match `pattern`, for example `*Util.ts` in `utils`.',
      'Test files are skipped unless `includeTests` is set.',
    ].join('\n'),
  },
  options: v.object({
    rules: v.array(
      v.object({
        directory: v.string(),
        pattern: v.string(),
        message: v.optional(v.string()),
        hint: v.optional(v.string()),
      }),
    ),
    includeTests: v.optional(v.boolean(), false),
  }),
  describe: (options) =>
    options.rules.map((rule) => `Files in ${rule.directory}/ are named ${rule.pattern}.`),
  create: (context) => ({
    file(file) {
      if (file.isTest && !context.options.includeTests) {
        return;
      }
      const directoryName = file.directory.slice(file.directory.lastIndexOf('/') + 1);
      const rule = context.options.rules.find(
        (candidate) =>
          GlobUtil.matchesName(file.directory, directoryName, candidate.directory) &&
          !GlobUtil.matches(file.name, candidate.pattern),
      );
      if (rule) {
        context.report({
          at: file,
          message: rule.message ?? `Files in ${directoryName}/ must be named ${rule.pattern}.`,
          hint: rule.hint,
        });
      }
    },
  }),
});
