import { defineRule, GlobUtil } from '@lanelint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { HintSchema, MessageSchema } from '../models/optionSchemas.ts';

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
    example: ['error', { names: ['index.ts', 'messages.ts'] }],
  },
  options: toStandardJsonSchema(
    v.object({
      names: v.pipe(
        v.array(v.string()),
        v.description('Globs of file names that may only exist at the root of an element.'),
      ),
    }),
  ),
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
    example: [
      'error',
      {
        rules: [
          { directory: 'utils', pattern: '*Util.ts' },
          { directory: 'hooks', pattern: 'use*.ts', message: 'Hooks start with use.' },
        ],
      },
    ],
  },
  options: toStandardJsonSchema(
    v.object({
      rules: v.pipe(
        v.array(
          v.object({
            directory: v.pipe(
              v.string(),
              v.description('Name of the parent directory, or a path glob when it contains `/`.'),
            ),
            pattern: v.pipe(
              v.string(),
              v.description(
                'Glob that file names in the directory must match, such as `*Util.ts`.',
              ),
            ),
            message: v.optional(MessageSchema),
            hint: v.optional(HintSchema),
          }),
        ),
        v.description('Name rules, each for a directory.'),
      ),
      includeTests: v.optional(v.pipe(v.boolean(), v.description('Also check test files.')), false),
    }),
  ),
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
