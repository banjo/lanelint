import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ProjectDirectory, ProjectFile } from '../models/project.ts';
import type { Rule, RuleContext, RuleMeta, Visitors } from '../models/rule.ts';

type OptionsOf<Schema> = Schema extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<Schema>
  : undefined;

type InputOf<Schema> = Schema extends StandardSchemaV1
  ? StandardSchemaV1.InferInput<Schema>
  : never;

export interface RuleDefinition<Schema extends StandardSchemaV1 | undefined> {
  readonly meta: RuleMeta;
  readonly options?: Schema;
  describe?(options: OptionsOf<Schema>): string | readonly string[];
  elementTypes?(options: OptionsOf<Schema>): readonly string[];
  create(context: RuleContext<OptionsOf<Schema>>): Visitors;
}

export function defineRule<Schema extends StandardSchemaV1 | undefined = undefined>(
  rule: RuleDefinition<Schema>,
): Rule<OptionsOf<Schema>, InputOf<Schema>> {
  return rule as Rule<OptionsOf<Schema>, InputOf<Schema>>;
}

interface ConditionRuleDefinition<Target> {
  readonly meta: RuleMeta;
  when(target: Target): boolean;
  readonly message: string | ((target: Target) => string);
  readonly hint?: string | ((target: Target) => string);
}

const text = <Target>(value: string | ((target: Target) => string), target: Target) =>
  typeof value === 'function' ? value(target) : value;

/** A rule that reports every file matching a condition. */
export function defineFileRule(definition: ConditionRuleDefinition<ProjectFile>) {
  return defineRule({
    meta: definition.meta,
    create: (context) => ({
      file(file) {
        if (definition.when(file)) {
          context.report({
            at: file,
            message: text(definition.message, file),
            hint: definition.hint === undefined ? undefined : text(definition.hint, file),
          });
        }
      },
    }),
  });
}

/** A rule that reports every directory matching a condition. */
export function defineDirectoryRule(definition: ConditionRuleDefinition<ProjectDirectory>) {
  return defineRule({
    meta: definition.meta,
    create: (context) => ({
      directory(directory) {
        if (definition.when(directory)) {
          context.report({
            at: directory,
            message: text(definition.message, directory),
            hint: definition.hint === undefined ? undefined : text(definition.hint, directory),
          });
        }
      },
    }),
  });
}
