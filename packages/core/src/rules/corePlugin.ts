import { definePlugin } from '../api/definePlugin.ts';
import { defineRule } from '../api/defineRule.ts';
import type { ResolvedConfig } from '../config/resolveConfig.ts';
import { GlobUtil } from '../utils/globUtil.ts';

export const CORE_PLUGIN_NAME = 'pilotlint';

/** Core rules. `no-git` and `parse-error` are reported by the engine; they exist here for config and docs. */
export function createCorePlugin(getConfig: () => ResolvedConfig) {
  const configChanged = defineRule({
    meta: {
      description: 'Reports changes to the pilotlint config, which need a human review.',
      severity: 'warn',
      docs: [
        'The pilotlint config defines what the project structure must look like. Changing it',
        'changes the rules, so the change needs a human review. This rule cannot be turned off.',
        '',
        'If you are an agent: do not change the config to make a finding go away. Revert the',
        'config change, fix the code instead, or ask a human to review the change.',
      ].join('\n'),
    },
    create: (context) => ({
      project(project) {
        if (!project.configFile || !context.changes.available) {
          return;
        }
        if (context.changes.get(project.configFile)) {
          context.report({
            at: 'project',
            message: `The pilotlint config ${project.configFile} changed and needs a human review.`,
            hint: 'Revert the config change and fix the code instead, or ask a human to review it.',
            key: 'config-changed',
          });
        }
      },
    }),
  });

  const staleConfig = defineRule({
    meta: {
      description: 'Reports element patterns and overrides that match nothing.',
      severity: 'warn',
      docs: [
        'An element pattern or override that matches nothing usually means the project',
        'structure changed and the config was not updated. Update or remove the entry.',
      ].join('\n'),
    },
    create: (context) => ({
      project(project) {
        const config = getConfig();
        const types = new Set(project.elements.map((element) => element.type));
        for (const definition of config.elementDefinitions) {
          if (!types.has(definition.type)) {
            context.report({
              at: 'project',
              message: `The element "${definition.type}" (${definition.pattern}) matches no directory.`,
              hint: 'Update the pattern or remove the element from the config.',
              key: `element:${definition.type}`,
            });
          }
        }
        for (const override of config.overrides) {
          if (!override.files && !override.elements) {
            continue;
          }
          const used = project.files.some(
            (file) =>
              (!override.files || GlobUtil.matches(file.path, override.files)) &&
              (!override.ignore || !GlobUtil.matches(file.path, override.ignore)) &&
              (!override.elements || override.elements.includes(file.element?.type ?? '')),
          );
          if (!used) {
            const name = override.description
              ? `"${override.description}"`
              : `#${override.index + 1}`;
            context.report({
              at: 'project',
              message: `The override ${name} matches no files.`,
              hint: 'Update its files and elements, or remove it from the config.',
              key: `override:${override.index}`,
            });
          }
        }
      },
    }),
  });

  const noGit = defineRule({
    meta: {
      description: 'Reports rules that need git when the project is not in a git repository.',
      severity: 'warn',
    },
    create: () => ({}),
  });

  const parseError = defineRule({
    meta: {
      description: 'Reports source files that cannot be parsed.',
      severity: 'error',
      docs: 'Rules cannot check a file that does not parse. Fix the syntax error first.',
    },
    create: () => ({}),
  });

  return definePlugin({
    name: CORE_PLUGIN_NAME,
    rules: {
      'config-changed': configChanged,
      'stale-config': staleConfig,
      'no-git': noGit,
      'parse-error': parseError,
    },
  });
}
