import type { CheckResult, Finding, Location } from '@lanelint/core';
import { color } from '../cli/logger.ts';

export interface ReportOptions {
  readonly maxFindings: number;
  readonly onlyNew: boolean;
  readonly base: string;
}

const where = (location: Location): string => {
  switch (location.kind) {
    case 'project':
      return '(project)';
    case 'directory':
    case 'element':
      return `${location.path}/`;
    default:
      return location.line ? `${location.path}:${location.line}` : location.path;
  }
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const formatFinding = (finding: Finding): string[] => {
  const severity = finding.severity === 'error' ? color('red', 'error') : color('yellow', 'warn');
  const lines = [
    `${color('cyan', where(finding.location))} ${severity} ${color('dim', finding.ruleId)} ${finding.message}`,
  ];
  if (finding.hint) {
    lines.push(`  ${color('dim', 'hint:')} ${finding.hint}`);
  }
  if (finding.related.length) {
    const shown = finding.related.slice(0, 5).map(where);
    const more = finding.related.length - shown.length;
    lines.push(
      `  ${color('dim', 'related:')} ${shown.join(', ')}${more > 0 ? `, +${more} more` : ''}`,
    );
  }
  return lines;
};

/** One line per finding plus hints, then a summary. Built for agents and terminals. */
export const formatCompact = (result: CheckResult, options: ReportOptions): string => {
  const shown = result.findings.slice(0, options.maxFindings);
  const hidden = result.findings.slice(shown.length);
  const lines = shown.flatMap(formatFinding);
  if (hidden.length) {
    const byRule = new Map<string, number>();
    for (const finding of hidden) {
      byRule.set(finding.ruleId, (byRule.get(finding.ruleId) ?? 0) + 1);
    }
    lines.push(
      `${plural(hidden.length, 'more finding')} not shown: ${[...byRule]
        .map(([id, count]) => `${id} (${count})`)
        .join(', ')}. Narrow the run with --rule or a path.`,
    );
  }
  const summary = `${plural(result.errorCount, 'error')}, ${plural(result.warningCount, 'warning')}`;
  const scope = `in ${plural(result.filesInScope, 'file')}${options.onlyNew ? `, new since ${options.base}` : ''}`;
  const status =
    result.errorCount > 0
      ? color('red', summary)
      : result.warningCount > 0
        ? color('yellow', summary)
        : color('green', summary);
  lines.push(`${status} ${scope} (${Math.round(result.durationMs)} ms)`);
  return lines.join('\n');
};
