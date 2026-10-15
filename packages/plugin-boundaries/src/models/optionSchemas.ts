import * as v from 'valibot';

export const SelectorSchema = v.union([
  v.pipe(v.string(), v.minLength(1)),
  v.pipe(
    v.strictObject({
      type: v.optional(v.string()),
      captures: v.optional(v.record(v.string(), v.union([v.string(), v.array(v.string())]))),
      files: v.optional(v.union([v.string(), v.array(v.string())])),
    }),
    v.check(
      (selector) => !!(selector.type || selector.captures || selector.files),
      'A selector needs type, captures, or files.',
    ),
  ),
]);

export type Selector = v.InferOutput<typeof SelectorSchema>;

/** One selector or a list, normalized to a list. Arrays are tried first, since objects accept them. */
export const SelectorListSchema = v.pipe(
  v.union([v.array(SelectorSchema), SelectorSchema]),
  v.transform((value) => (Array.isArray(value) ? value : [value])),
);

export const GlobListSchema = v.pipe(
  v.union([v.string(), v.array(v.string())]),
  v.transform((value) => (typeof value === 'string' ? [value] : value)),
);
