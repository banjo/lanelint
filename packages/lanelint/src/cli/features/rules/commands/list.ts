import type { ResolvedConfig } from '@lanelint/core';
import { defineCommand } from 'citty';
import { color } from '../../../logger.ts';
import { EXIT_CODES } from '../../../constants/exitCodes.ts';
import { CommandService } from '../../../services/commandService.ts';
import { ConfigService } from '../../../services/configService.ts';

const levelsOf = (config: ResolvedConfig, id: string) => {
  const levels = new Set<string>();
  const base = config.base.get(id)?.level ?? 'off';
  levels.add(base);
  const overrides = config.overrides.filter((override) => override.rules.has(id));
  for (const override of overrides) {
    levels.add(override.rules.get(id)?.level ?? base);
  }
  return { base, overrides: overrides.length, levels };
};

export const list = defineCommand({
  meta: {
    name: 'list',
    description: 'List the active rules with their level and description',
  },
  args: {
    config: {
      type: 'string',
      description: 'Path to the config file',
    },
  },
  run: ({ args }) =>
    CommandService.run(async () => {
      const config = await ConfigService.load({ cwd: process.cwd(), config: args.config });
      const ids = [...new Set(config.instances.map((instance) => instance.ruleId))].sort();
      const width = Math.max(...ids.map((id) => id.length));
      for (const id of ids) {
        const { base, overrides } = levelsOf(config, id);
        const rule = config.rules.get(id);
        const scope = overrides
          ? color('dim', ` (${overrides} override${overrides === 1 ? '' : 's'})`)
          : '';
        console.log(
          `${base.padEnd(5)} ${id.padEnd(width)}  ${rule?.meta.description ?? ''}${scope}`,
        );
      }
      return EXIT_CODES.ok;
    }),
});
