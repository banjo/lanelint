import type { CheckResult } from '@archlint/core';
import type { ReportOptions } from './compactReporter.ts';

/** Stable machine-readable output. `version` changes only on breaking changes. */
export const formatJson = (result: CheckResult, options: ReportOptions): string =>
  JSON.stringify(
    {
      version: 1,
      summary: {
        errors: result.errorCount,
        warnings: result.warningCount,
        files: result.filesInScope,
        durationMs: Math.round(result.durationMs),
        failed: result.failed,
        onlyNew: options.onlyNew,
        base: options.base,
      },
      findings: result.findings,
    },
    null,
    2,
  );
