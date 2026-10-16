import * as v from 'valibot';

export const MessageSchema = v.pipe(
  v.string(),
  v.description('Replaces the finding message, for example to say what to do instead.'),
);

export const HintSchema = v.pipe(
  v.string(),
  v.description('Shown under the finding as the next step.'),
);

export const NamePatternSchema = v.object({
  name: v.pipe(
    v.string(),
    v.description('File or directory name glob, or a path glob when it contains `/`.'),
  ),
  message: v.optional(MessageSchema),
  hint: v.optional(HintSchema),
});

export const CaseSchema = v.pipe(
  v.picklist(['kebab', 'camel', 'pascal', 'snake']),
  v.title('Case'),
  v.description('A naming case: `kebab-case`, `camelCase`, `PascalCase`, or `snake_case`.'),
);

export type Case = v.InferOutput<typeof CaseSchema>;
