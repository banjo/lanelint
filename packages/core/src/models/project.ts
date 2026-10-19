export interface ElementInfo {
  readonly type: string;
  /** The element root path. Unique per element. */
  readonly id: string;
  readonly root: string;
  readonly captures: Readonly<Record<string, string>>;
  /** Path inside the element root. Empty for the root directory itself. */
  readonly relativePath: string;
  readonly isEntry: boolean;
}

export interface ProjectFile {
  readonly kind: 'file';
  readonly path: string;
  readonly absolutePath: string;
  /** File name with extensions, for example `Button.test.tsx`. */
  readonly name: string;
  /** File name up to the first dot, for example `Button`. */
  readonly stem: string;
  /** Last extension including the dot, for example `.tsx`. Empty when there is none. */
  readonly extension: string;
  /** Parent directory path. Empty for files in the project root. */
  readonly directory: string;
  /** JS or TS file that can be parsed. */
  readonly isSource: boolean;
  readonly isTest: boolean;
  readonly element: ElementInfo | undefined;
}

export interface ProjectDirectory {
  readonly kind: 'directory';
  readonly path: string;
  readonly absolutePath: string;
  readonly name: string;
  readonly parent: string | undefined;
  readonly element: ElementInfo | undefined;
}

export interface Element {
  readonly kind: 'element';
  readonly type: string;
  readonly id: string;
  readonly root: string;
  readonly captures: Readonly<Record<string, string>>;
  readonly description: string | undefined;
  /** Configured entry paths relative to the element root. */
  readonly entries: readonly string[];
  readonly files: readonly ProjectFile[];
  readonly entryFiles: readonly ProjectFile[];
}

export interface PackageInfo {
  readonly name: string | undefined;
  /** Directory of the `package.json`, relative to the project root. Empty for the root. */
  readonly directory: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  /** The `exports` field as written, or `undefined` when the package has none. */
  readonly exports: unknown;
}
