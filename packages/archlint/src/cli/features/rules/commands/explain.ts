import { UsageError } from '@archlint/core';
import { defineCommand } from 'citty';
import { CliUtil } from '../../../utils/cliUtil.ts';
import { ConfigUtil } from '../../../utils/configUtil.ts';

export const explain = defineCommand({
  meta: {
    name: 'explain',
    description: 'Explain a rule: what it checks, how it is configured, and how to fix findings',
  },
  args: {
    id: {
      type: 'positional',
      required: true,
      description: 'Rule id, for example boundaries/entry-only',
    },
    config: {
      type: 'string',
      description: 'Path to the config file',
    },
  },
  run: ({ args }) =>
    CliUtil.run(async () => {
      const config = await ConfigUtil.load({ cwd: process.cwd(), config: args.config });
      const rule = config.rules.get(args.id);
      if (!rule) {
        throw new UsageError(
          `Unknown rule "${args.id}". Run archlint rules list to see the active rules.`,
        );
      }
      const lines = [`# ${args.id}`, '', rule.meta.description, ''];
      const instances = config.instances.filter((instance) => instance.ruleId === args.id);
      if (!instances.length) {
        lines.push('This rule is off in this project.', '');
      }
      const base = config.base.get(args.id);
      if (base && base.level !== 'off') {
        lines.push(`Level: ${base.level} everywhere.`);
      }
      for (const override of config.overrides) {
        const entry = override.rules.get(args.id);
        if (entry) {
          const name = override.description ?? `override #${override.index + 1}`;
          lines.push(`Level: ${entry.level} in "${name}".`);
        }
      }
      for (const instance of instances) {
        const described = rule.describe?.(instance.options);
        if (described) {
          lines.push('', ...(typeof described === 'string' ? [described] : described));
        }
      }
      if (rule.meta.docs) {
        lines.push('', rule.meta.docs);
      }
      console.log(lines.join('\n').trimEnd());
      return CliUtil.exit.ok;
    }),
});
