import * as v from 'valibot';

export const NamePatternSchema = v.object({
  /** File or directory name glob, or a path glob when it contains `/`. */
  name: v.string(),
  message: v.optional(v.string()),
  hint: v.optional(v.string()),
});

export const CaseSchema = v.picklist(['kebab', 'camel', 'pascal', 'snake']);

export type Case = v.InferOutput<typeof CaseSchema>;
