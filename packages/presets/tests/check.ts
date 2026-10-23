import type { ConfigFragment, LanelintConfig } from '@lanelint/core';
import { runConfig, type Files } from '@lanelint/core/testing';

/** Core rules that depend on git, which the fixtures do not use. */
const GIT_RULES = new Set(['lanelint/no-git', 'lanelint/config-changed']);

/** Checks files with presets, and lists findings as `path:line rule message`, plus the hint when asked. */
export async function check(
  presets: readonly ConfigFragment[],
  files: Files,
  { hints = false, ...config }: Omit<LanelintConfig, 'extends'> & { readonly hints?: boolean } = {},
): Promise<string[]> {
  const findings = await runConfig({ ...config, extends: presets }, { files });
  return findings
    .filter((finding) => !GIT_RULES.has(finding.ruleId))
    .map(
      (finding) =>
        `${finding.location.path}:${finding.location.line ?? '-'} ${finding.ruleId} ${finding.message}${hints && finding.hint ? ` (${finding.hint})` : ''}`,
    );
}
