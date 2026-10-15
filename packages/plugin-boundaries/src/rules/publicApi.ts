import {
  defineRule,
  GlobUtil,
  type ImportEdge,
  type ProjectApi,
  type ProjectFile,
} from '@archlint/core';
import * as v from 'valibot';
import { EdgeUtil } from '../utils/edgeUtil.ts';
import { GlobListSchema, SelectorListSchema } from '../models/optionSchemas.ts';
import { SelectorUtil } from '../utils/selectorUtil.ts';

/** Files reachable from an element's entry files through re-exports. */
const publicFilesOf = async (project: ProjectApi, entries: readonly ProjectFile[]) => {
  const reachable = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (!file || reachable.has(file.path)) {
      continue;
    }
    reachable.add(file.path);
    for (const edge of await project.importsOf(file)) {
      if (edge.reexport && edge.target.type === 'internal') {
        queue.push(edge.target.file);
      }
    }
  }
  return reachable;
};

export const publicApi = defineRule({
  meta: {
    description: 'Imported files of an element must be reachable from its entry files.',
    severity: 'error',
    docs: [
      'Some elements allow imports of individual files, as long as those files are part of the',
      'public API: reachable from an entry file through re-exports, directly or through other',
      'barrels. The rule checks files, not individual exported names.',
      '',
      'To fix a finding, export the file from the element entry (or a barrel it re-exports), or',
      'import something that is already public.',
    ].join('\n'),
  },
  options: v.object({
    elements: SelectorListSchema,
    from: v.optional(SelectorListSchema),
    exceptions: v.optional(
      v.array(v.object({ from: v.optional(SelectorListSchema), to: GlobListSchema })),
      [],
    ),
    includeTests: v.optional(v.boolean(), false),
  }),
  describe: (options) =>
    `${options.from ? `${SelectorUtil.describe(options.from)} imports files` : 'Files'} in a ${SelectorUtil.describe(options.elements)} element ${options.from ? '' : 'are imported from outside '}only when its entry files export them.`,
  elementTypes: (options) => [
    ...SelectorUtil.typesOf(options.elements),
    ...SelectorUtil.typesOf(options.from),
    ...options.exceptions.flatMap((exception) => SelectorUtil.typesOf(exception.from)),
  ],
  create: (context) => {
    const candidates: ImportEdge[] = [];
    return {
      import(edge) {
        const to = EdgeUtil.internalTarget(edge);
        const element = to?.element;
        const { options } = context;
        if (
          !to ||
          !element ||
          element.isEntry ||
          edge.from.element?.id === element.id ||
          EdgeUtil.skip(edge, options) ||
          !SelectorUtil.matches(options.elements, to) ||
          (options.from && !SelectorUtil.matches(options.from, edge.from)) ||
          options.exceptions.some(
            (exception) =>
              (!exception.from || SelectorUtil.matches(exception.from, edge.from)) &&
              GlobUtil.matches(to.path, exception.to),
          )
        ) {
          return;
        }
        candidates.push(edge);
      },
      async project(project) {
        const publicFiles = new Map<string, Set<string>>();
        for (const edge of candidates) {
          const to = EdgeUtil.internalTarget(edge);
          const element = to?.element && project.element(to.element.id);
          if (!to || !element) {
            continue;
          }
          let reachable = publicFiles.get(element.id);
          if (!reachable) {
            reachable = await publicFilesOf(project, element.entryFiles);
            publicFiles.set(element.id, reachable);
          }
          if (!reachable.has(to.path)) {
            context.report({
              at: edge,
              message: `${to.path} is not exported from the entry files of ${element.root}.`,
              hint: `Export it from ${element.entryFiles.map((file) => file.path).join(' or ') || 'an entry file'}, or import something that is.`,
            });
          }
        }
      },
    };
  },
});
