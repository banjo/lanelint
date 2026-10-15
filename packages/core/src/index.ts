export { defineConfig, defineConfigFragment, definePlugin } from './api/definePlugin.ts';
export {
  defineDirectoryRule,
  defineFileRule,
  defineRule,
  type RuleDefinition,
} from './api/defineRule.ts';
export {
  DEFAULT_TESTS,
  resolveConfig,
  type ResolveConfigOptions,
  type ResolvedConfig,
  type RuleInstance,
} from './config/resolveConfig.ts';
export {
  describeProject,
  type ElementDescription,
  type PathDescription,
  type ProjectDescription,
  type RuleDescription,
  type RuleGroupDescription,
} from './describe/describeProject.ts';
export { check, type CheckOptions, type CheckResult } from './engine/check.ts';
export { ConfigError, UsageError } from './errors.ts';
export type { Change, ChangeSet, ChangeStatus } from './models/changes.ts';
export type {
  AnyPlugin,
  ArchlintConfig,
  ConfigFragment,
  CoreRuleId,
  ElementDefinition,
  OverrideConfig,
  Plugin,
  RuleEntry,
  RulesConfig,
  RulesFor,
} from './models/config.ts';
export type { FailOn, Finding, Level, Location, LocationKind, Severity } from './models/finding.ts';
export type {
  AstInfo,
  Comment,
  ImportEdge,
  ImportSyntax,
  ImportTarget,
  ModuleExport,
  ModuleImport,
  ModuleInfo,
  Program,
} from './models/module.ts';
export type {
  Element,
  ElementInfo,
  PackageInfo,
  ProjectDirectory,
  ProjectFile,
} from './models/project.ts';
export type {
  AnyRule,
  Graph,
  LocationInput,
  ProjectApi,
  ReportDescriptor,
  Rule,
  RuleContext,
  RuleMeta,
  Visitors,
} from './models/rule.ts';
export { GlobUtil } from './utils/globUtil.ts';
