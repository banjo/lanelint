import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ChangeSet } from './changes.ts';
import type { RuleEntry } from './config.ts';
import type { Severity } from './finding.ts';
import type { AstInfo, ImportEdge, ModuleInfo } from './module.ts';
import type {
  Element,
  ElementInfo,
  PackageInfo,
  ProjectDirectory,
  ProjectFile,
} from './project.ts';

export type LocationInput =
  | ProjectFile
  | ProjectDirectory
  | Element
  | ImportEdge
  | 'project'
  | { readonly path: string; readonly line?: number; readonly column?: number };

export interface ReportDescriptor {
  readonly at: LocationInput;
  /** What is wrong. Must not contain line numbers, since it is part of the finding identity. */
  readonly message: string;
  /** A concrete next step. */
  readonly hint?: string;
  /** Identity of the finding within its location. Defaults to the message. */
  readonly key?: string;
  /** Other locations, for example the edges of a cycle. */
  readonly related?: readonly LocationInput[];
}

export interface Graph {
  readonly edges: readonly ImportEdge[];
  importsOf(file: ProjectFile | string): readonly ImportEdge[];
  importersOf(file: ProjectFile | string): readonly ImportEdge[];
}

export interface ProjectApi {
  readonly root: string;
  /** Config file path relative to the root, when the config was loaded from a file. */
  readonly configFile: string | undefined;
  readonly files: readonly ProjectFile[];
  readonly directories: readonly ProjectDirectory[];
  readonly elements: readonly Element[];
  file(path: string): ProjectFile | undefined;
  directory(path: string): ProjectDirectory | undefined;
  element(id: string): Element | undefined;
  exists(path: string): boolean;
  /** Element membership for any path, including paths that do not exist. */
  elementAt(path: string): ElementInfo | undefined;
  packageOf(at: ProjectFile | string): PackageInfo | undefined;
  /** Workspace package by name, for packages inside the project. */
  workspacePackage(name: string): PackageInfo | undefined;
  read(path: string): Promise<string | undefined>;
  module(file: ProjectFile): Promise<ModuleInfo | undefined>;
  ast(file: ProjectFile): Promise<AstInfo | undefined>;
  importsOf(file: ProjectFile): Promise<readonly ImportEdge[]>;
  /** Parses and resolves every source file. */
  graph(): Promise<Graph>;
}

export interface Visitors {
  file?(file: ProjectFile): void;
  directory?(directory: ProjectDirectory): void;
  element?(element: Element): void;
  text?(file: ProjectFile, text: string): void;
  module?(file: ProjectFile, module: ModuleInfo): void;
  import?(edge: ImportEdge): void;
  ast?(file: ProjectFile, ast: AstInfo): void;
  project?(project: ProjectApi): void | Promise<void>;
}

export interface RuleContext<Options> {
  readonly id: string;
  readonly options: Options;
  readonly project: ProjectApi;
  /** Changed files compared with the base ref. Computed on first use. */
  readonly changes: ChangeSet;
  report(descriptor: ReportDescriptor): void;
  isInScope(at: LocationInput): boolean;
}

export interface RuleMeta<Input = unknown> {
  readonly description: string;
  /** Default level, used when the config enables the rule without a level. */
  readonly severity: Severity;
  /** Markdown shown by `pilotlint rules explain` and `pilotlint rules docs`. */
  readonly docs?: string;
  /** An example entry for the rule in the config, shown by `pilotlint rules docs`. */
  readonly example?: RuleEntry<Input>;
}

export interface Rule<Options = unknown, Input = unknown> {
  readonly meta: RuleMeta<Input>;
  readonly options?: StandardSchemaV1<Input, Options>;
  // Methods rather than function properties, so any rule is assignable to `AnyRule`.
  /** What the rule enforces with these options, for `pilotlint describe`. */
  describe?(options: Options): string | readonly string[];
  /** Element types referenced by these options, validated against the config. */
  elementTypes?(options: Options): readonly string[];
  create(context: RuleContext<Options>): Visitors;
  /** Type of the options accepted in config. Never set at runtime. */
  readonly '~input'?: Input;
}

export type AnyRule = Rule<unknown, unknown>;
