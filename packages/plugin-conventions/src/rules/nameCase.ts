import { defineRule, GlobUtil } from '@lanelint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { CaseSchema } from '../models/optionSchemas.ts';
import { CaseUtil } from '../utils/caseUtil.ts';

const CasesSchema = v.pipe(
  v.union([CaseSchema, v.array(CaseSchema)]),
  v.description('Allowed cases. Suggestions use the first.'),
  v.transform((value) => (typeof value === 'string' ? [value] : value)),
);

const ignoreSchema = (defaults: string[]) =>
  v.optional(
    v.pipe(v.array(v.string()), v.description('Globs of names that are not checked.')),
    defaults,
  );

export const fileNameCase = defineRule({
  meta: {
    description: 'File names follow a naming case.',
    severity: 'error',
    docs: [
      'The part of the file name before the first dot must follow one of the configured cases,',
      'so `Button.test.tsx` is checked as `Button`. Use overrides for areas with other',
      'conventions, for example PascalCase for components and camelCase for hooks.',
      'Files named `index.*` and dotfiles are ignored by default.',
    ].join('\n'),
    example: ['error', { case: ['camel', 'pascal'], ignore: ['index.*', '.*', '*.md'] }],
  },
  options: toStandardJsonSchema(
    v.object({
      case: CasesSchema,
      ignore: ignoreSchema(['index.*', '.*']),
    }),
  ),
  describe: (options) => `File names use ${CaseUtil.describe(options.case)}.`,
  create: (context) => ({
    file(file) {
      if (
        GlobUtil.matches(file.name, context.options.ignore) ||
        CaseUtil.matches(file.stem, context.options.case)
      ) {
        return;
      }
      const [first = 'kebab'] = context.options.case;
      const suggestion = `${CaseUtil.convert(file.stem, first)}${file.name.slice(file.stem.length)}`;
      context.report({
        at: file,
        message: `Rename ${file.name} to ${CaseUtil.describe(context.options.case)}.`,
        hint: `For example ${suggestion}.`,
      });
    },
  }),
});

export const directoryCase = defineRule({
  meta: {
    description: 'Directory names follow a naming case.',
    severity: 'error',
    docs: [
      'Directory names must follow one of the configured cases. Names like `__tests__` and',
      'dot directories are ignored by default.',
    ].join('\n'),
    example: ['error', { case: 'kebab' }],
  },
  options: toStandardJsonSchema(
    v.object({
      case: CasesSchema,
      ignore: ignoreSchema(['__*__', '.*']),
    }),
  ),
  describe: (options) => `Directory names use ${CaseUtil.describe(options.case)}.`,
  create: (context) => ({
    directory(directory) {
      if (
        GlobUtil.matches(directory.name, context.options.ignore) ||
        CaseUtil.matches(directory.name, context.options.case)
      ) {
        return;
      }
      const [first = 'kebab'] = context.options.case;
      context.report({
        at: directory,
        message: `Rename ${directory.name}/ to ${CaseUtil.describe(context.options.case)}.`,
        hint: `For example ${CaseUtil.convert(directory.name, first)}/.`,
      });
    },
  }),
});
