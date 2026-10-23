/** A problem with the config or the plugins it loads. The CLI exits with code 2. */
export class ConfigError extends Error {
  readonly details: readonly string[];

  constructor(message: string, details: readonly string[] = []) {
    super(
      details.length ? `${message}\n${details.map((line) => `  - ${line}`).join('\n')}` : message,
    );
    this.name = 'ConfigError';
    this.details = details;
  }
}

/** A problem with how lanelint was called, for example an unknown base ref. Exit code 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}
