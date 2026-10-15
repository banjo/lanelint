import type { Comment, Program } from 'oxc-parser';
import type { ProjectFile } from './project.ts';

export type { Comment, Program };

export type ImportSyntax = 'import' | 'export' | 'dynamic' | 'require';

export interface ModuleImport {
  readonly specifier: string;
  readonly line: number;
  readonly syntax: ImportSyntax;
  readonly typeOnly: boolean;
  /** Imported or re-exported names. `default` for default imports, `*` for namespaces. */
  readonly names: readonly string[];
  /** Local binding names created by the import. */
  readonly locals: readonly string[];
  /** The module is re-exported: `export ... from`, or an imported binding that is exported. */
  readonly reexport: boolean;
}

export interface ModuleExport {
  /** Exported name. `default` for default exports, `*` for `export * from`. */
  readonly name: string;
  readonly local: string | undefined;
  readonly typeOnly: boolean;
  readonly line: number;
  /** Offset of the export entry. */
  readonly start: number;
  /** Offset of the whole export statement, where JSDoc comments attach. */
  readonly statementStart: number;
  readonly specifier: string | undefined;
}

export interface ModuleInfo {
  readonly imports: readonly ModuleImport[];
  readonly exports: readonly ModuleExport[];
  readonly hasModuleSyntax: boolean;
}

export interface AstInfo {
  /** Built on first access. Comments and module info are cheap without it. */
  readonly program: Program;
  readonly comments: readonly Comment[];
  readonly text: string;
  readonly module: ModuleInfo;
  lineOf(offset: number): number;
  /** Comments directly before an offset, separated only by whitespace. */
  leadingComments(offset: number): readonly Comment[];
}

export type ImportTarget =
  | { readonly type: 'internal'; readonly file: ProjectFile }
  | { readonly type: 'external'; readonly package: string; readonly path: string | undefined }
  | { readonly type: 'builtin'; readonly module: string }
  | { readonly type: 'excluded'; readonly path: string }
  | { readonly type: 'unresolved' };

export interface ImportEdge {
  readonly kind: 'edge';
  readonly from: ProjectFile;
  readonly specifier: string;
  readonly line: number;
  readonly syntax: ImportSyntax;
  readonly typeOnly: boolean;
  readonly names: readonly string[];
  /** The imported module is re-exported by `from`, directly or through an imported binding. */
  readonly reexport: boolean;
  readonly target: ImportTarget;
}
