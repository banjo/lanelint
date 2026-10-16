import { defineRule, type ImportEdge } from '@pilotlint/core';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { EdgeUtil } from '../utils/edgeUtil.ts';
import {
  IgnoreTypeImportsSchema,
  IncludeTestsSchema,
  SelectorListSchema,
} from '../models/optionSchemas.ts';
import { SelectorUtil } from '../utils/selectorUtil.ts';

/** The same cycle has the same signature no matter where it starts. */
const signatureOf = (ids: readonly string[]) =>
  ids.map((_, index) => [...ids.slice(index), ...ids.slice(0, index)].join(' -> ')).sort()[0] ?? '';

const byLocation = (a: ImportEdge, b: ImportEdge) =>
  a.from.path.localeCompare(b.from.path) || a.line - b.line;

export const noCycles = defineRule({
  meta: {
    description: 'Elements must not depend on each other in a cycle.',
    severity: 'error',
    docs: [
      'A cycle between elements means none of them can be understood, tested, or moved on its',
      'own. The finding shows the import that closes the cycle and the other imports in it.',
      '',
      'To fix a finding, move the shared code into an element both can depend on, or invert one',
      'of the dependencies, for example by passing a callback instead of importing.',
    ].join('\n'),
    example: ['error', { ignoreTypeImports: true }],
  },
  options: toStandardJsonSchema(
    v.optional(
      v.object({
        elements: v.optional(
          v.pipe(
            SelectorListSchema,
            v.description('Elements to check. Defaults to every element.'),
          ),
        ),
        includeTests: IncludeTestsSchema,
        ignoreTypeImports: IgnoreTypeImportsSchema,
      }),
      {},
    ),
  ),
  describe: (options) =>
    options.elements
      ? `${SelectorUtil.describe(options.elements)} elements do not depend on each other in a cycle.`
      : 'Elements do not depend on each other in a cycle.',
  elementTypes: (options) => SelectorUtil.typesOf(options.elements),
  create: (context) => ({
    async project(project) {
      const { options } = context;
      const graph = await project.graph();
      // Element-level graph with the first import of each pair as its representative.
      const pairs = new Map<
        string,
        Map<string, { first: ImportEdge; scoped: ImportEdge | undefined }>
      >();
      for (const edge of [...graph.edges].sort(byLocation)) {
        const to = EdgeUtil.internalTarget(edge);
        const fromId = edge.from.element?.id;
        const toId = to?.element?.id;
        if (
          !to ||
          !fromId ||
          !toId ||
          fromId === toId ||
          EdgeUtil.skip(edge, options) ||
          (options.elements &&
            (!SelectorUtil.matches(options.elements, edge.from) ||
              !SelectorUtil.matches(options.elements, to)))
        ) {
          continue;
        }
        const outgoing = pairs.get(fromId) ?? new Map();
        const pair = outgoing.get(toId) ?? { first: edge, scoped: undefined };
        if (!pair.scoped && context.isInScope(edge)) {
          pair.scoped = edge;
        }
        outgoing.set(toId, pair);
        pairs.set(fromId, outgoing);
      }

      const pathBack = (start: string, goal: string): ImportEdge[] | undefined => {
        const visited = new Set([start]);
        const queue: { id: string; path: ImportEdge[] }[] = [{ id: start, path: [] }];
        for (let index = 0; index < queue.length; index++) {
          const current = queue[index];
          if (!current) {
            break;
          }
          for (const [next, pair] of [...(pairs.get(current.id) ?? [])].sort(([a], [b]) =>
            a.localeCompare(b),
          )) {
            const path = [...current.path, pair.first];
            if (next === goal) {
              return path;
            }
            if (!visited.has(next)) {
              visited.add(next);
              queue.push({ id: next, path });
            }
          }
        }
        return undefined;
      };

      // Pairs with an import in scope come first, so cycles are anchored at the changed code.
      const candidates = [...pairs]
        .flatMap(([fromId, outgoing]) =>
          [...outgoing].map(([toId, pair]) => ({ fromId, toId, pair })),
        )
        .sort(
          (a, b) =>
            Number(!a.pair.scoped) - Number(!b.pair.scoped) ||
            a.fromId.localeCompare(b.fromId) ||
            a.toId.localeCompare(b.toId),
        );
      const reported = new Set<string>();
      for (const { fromId, toId, pair } of candidates) {
        const back = pathBack(toId, fromId);
        if (!back) {
          continue;
        }
        const ids = [
          fromId,
          toId,
          ...back.slice(0, -1).map((edge) => EdgeUtil.internalTarget(edge)?.element?.id ?? ''),
        ];
        const signature = signatureOf(ids);
        if (reported.has(signature)) {
          continue;
        }
        reported.add(signature);
        context.report({
          at: pair.scoped ?? pair.first,
          message: `Dependency cycle: ${[...ids, fromId].join(' -> ')}.`,
          hint: 'Move the shared code to an element both can depend on, or invert one dependency.',
          key: signature,
          related: back,
        });
      }
    },
  }),
});
