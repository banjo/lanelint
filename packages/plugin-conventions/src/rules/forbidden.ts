import { defineRule, GlobUtil } from '@pilotlint/core';
import * as v from 'valibot';
import { NamePatternSchema } from '../models/optionSchemas.ts';

const describePatterns = (kind: string, patterns: readonly { name: string; message?: string }[]) =>
  patterns.map(
    (pattern) => `No ${kind} named ${pattern.name}.${pattern.message ? ` ${pattern.message}` : ''}`,
  );

export const forbiddenFiles = defineRule({
  meta: {
    description: 'Files with these names must not exist.',
    severity: 'error',
    docs: [
      'Each pattern matches the file name, or the path when it contains `/`. Give each pattern',
      'a message that says what to do instead, for example where the code belongs.',
    ].join('\n'),
  },
  options: v.object({ patterns: v.array(NamePatternSchema) }),
  describe: (options) => describePatterns('files', options.patterns),
  create: (context) => ({
    file(file) {
      const pattern = context.options.patterns.find((candidate) =>
        GlobUtil.matchesName(file.path, file.name, candidate.name),
      );
      if (pattern) {
        context.report({
          at: file,
          message: pattern.message ?? `Files named ${pattern.name} are not allowed.`,
          hint: pattern.hint,
        });
      }
    },
  }),
});

export const forbiddenDirectories = defineRule({
  meta: {
    description: 'Directories with these names must not exist.',
    severity: 'error',
    docs: [
      'Each pattern matches the directory name, or the path when it contains `/`. Give each',
      'pattern a message that says what to do instead.',
    ].join('\n'),
  },
  options: v.object({ patterns: v.array(NamePatternSchema) }),
  describe: (options) => describePatterns('directories', options.patterns),
  create: (context) => ({
    directory(directory) {
      const pattern = context.options.patterns.find((candidate) =>
        GlobUtil.matchesName(directory.path, directory.name, candidate.name),
      );
      if (pattern) {
        context.report({
          at: directory,
          message: pattern.message ?? `Directories named ${pattern.name} are not allowed.`,
          hint: pattern.hint,
        });
      }
    },
  }),
});
