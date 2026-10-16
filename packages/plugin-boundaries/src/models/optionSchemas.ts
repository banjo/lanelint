import * as v from 'valibot';

export const SelectorSchema = v.pipe(
  v.union([
    v.pipe(v.string(), v.minLength(1)),
    v.pipe(
      v.strictObject({
        type: v.optional(v.pipe(v.string(), v.description('Element type.'))),
        captures: v.optional(
          v.pipe(
            v.record(v.string(), v.union([v.string(), v.array(v.string())])),
            v.description(
              'Allowed values per capture of the element pattern, such as `{ name: "auth" }`.',
            ),
          ),
        ),
        files: v.optional(
          v.pipe(
            v.union([v.string(), v.array(v.string())]),
            v.description('Globs matched against file paths.'),
          ),
        ),
      }),
      v.check(
        (selector) => !!(selector.type || selector.captures || selector.files),
        'A selector needs type, captures, or files.',
      ),
    ),
  ]),
  v.title('Selector'),
  v.description(
    'An element type, or an object that matches elements by type and captures, or files by glob. All given fields must match.',
  ),
);

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

export const MessageSchema = v.pipe(
  v.string(),
  v.description('Replaces the finding message, for example to explain the rule.'),
);

export const ReasonSchema = v.pipe(
  v.string(),
  v.description('Added to the finding message, for example the reason for the restriction.'),
);

export const HintSchema = v.pipe(
  v.string(),
  v.description('Shown under the finding as the next step.'),
);

export const IncludeTestsSchema = v.optional(
  v.pipe(v.boolean(), v.description('Also check imports from test files.')),
  false,
);

export const IgnoreTypeImportsSchema = v.optional(
  v.pipe(v.boolean(), v.description('Skip imports that only import types.')),
  false,
);
