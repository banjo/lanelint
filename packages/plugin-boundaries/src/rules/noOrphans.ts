import { defineRule, GlobUtil } from '@lanelint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';

export const noOrphans = defineRule({
  meta: {
    description: 'Source files must be imported by non-test code, or be an entry point.',
    severity: 'warn',
    docs: [
      'A file that only tests import is usually left over from a refactor. Entry files of elements,',
      'test files, declaration files, config files, and files matching `roots` are entry points',
      'and are never reported. List other entry points, such as `src/main.ts` or CLI scripts, in',
      '`roots`.',
      '',
      'To fix a finding, delete the file if it is unused, import it where it is needed, or add it',
      'to `roots` if it is an entry point.',
    ].join('\n'),
    example: ['warn', { roots: ['src/main.ts', 'scripts/**'] }],
  },
  options: toStandardJsonSchema(
    v.optional(
      v.object({
        roots: v.optional(
          v.pipe(
            v.array(v.string()),
            v.description('Globs of entry points, such as `src/main.ts`, that nothing imports.'),
          ),
          [],
        ),
      }),
      {},
    ),
  ),
  create: (context) => ({
    async project(project) {
      const roots = ['**/*.config.*', '**/*.d.ts', '**/*.d.mts', ...context.options.roots];
      const candidates = project.files.filter(
        (file) =>
          file.isSource &&
          !file.isTest &&
          !file.element?.isEntry &&
          !GlobUtil.matches(file.path, roots) &&
          context.isInScope(file),
      );
      if (!candidates.length) {
        return;
      }
      const graph = await project.graph();
      for (const file of candidates) {
        if (
          !graph.importersOf(file).some((edge) => !edge.from.isTest && edge.from.path !== file.path)
        ) {
          context.report({
            at: file,
            message: `Nothing imports ${file.path}.`,
            hint: 'Delete it if it is unused, import it where it is needed, or add it to roots if it is an entry point.',
          });
        }
      }
    },
  }),
});
