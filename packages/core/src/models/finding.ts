export type Severity = 'warn' | 'error';

export type Level = 'off' | Severity;

export type FailOn = Severity | 'never';

export type LocationKind = 'file' | 'path' | 'directory' | 'element' | 'project';

/**
 * Where a finding is. `path` is relative to the project root with `/` separators,
 * and empty for the project. `path` locations point at paths that do not exist.
 */
export interface Location {
  readonly kind: LocationKind;
  readonly path: string;
  readonly line?: number;
  readonly column?: number;
}

export interface Finding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly hint?: string;
  readonly location: Location;
  readonly related: readonly Location[];
  /** Rule id, location kind and path, and key. Never contains line numbers. */
  readonly identity: string;
}
