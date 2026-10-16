import { relative, resolve } from 'node:path';
import { renderRuleDocs, UsageError } from '@pilotlint/core';
import { defineCommand } from 'citty';
import { EXIT_CODES } from '../../../constants/exitCodes.ts';
import { logger } from '../../../logger.ts';
import { CommandService } from '../../../services/commandService.ts';
import { ConfigService } from '../../../services/configService.ts';
import { RuleDocsService } from '../../../services/ruleDocsService.ts';
import { ArgsUtil } from '../../../utils/argsUtil.ts';

export const docs = defineCommand({
  meta: {
    name: 'docs',
    description: 'Write Markdown docs for the rules: an index and one page per plugin',
  },
  args: {
    out: {
      type: 'string',
      default: 'docs/rules',
      description: 'Directory to write the docs to',
    },
    check: {
      type: 'boolean',
      description: 'Write nothing, and exit with code 1 when the docs are out of date',
    },
    plugin: {
      type: 'string',
      description: 'Only document this plugin. Repeat or separate names with commas',
    },
    config: {
      type: 'string',
      description: 'Path to the config file',
    },
  },
  run: ({ args, rawArgs }) =>
    CommandService.run(async () => {
      const cwd = process.cwd();
      const config = await ConfigService.load({ cwd, config: args.config });
      const names = ArgsUtil.repeated(rawArgs, 'plugin');
      const unknown = names.filter(
        (name) => !config.plugins.some((plugin) => plugin.name === name),
      );
      if (unknown.length) {
        const known = config.plugins.map((plugin) => plugin.name).join(', ');
        throw new UsageError(`Unknown plugin "${unknown.join('", "')}". Plugins: ${known}.`);
      }
      const plugins = names.length
        ? config.plugins.filter((plugin) => names.includes(plugin.name))
        : config.plugins;
      const files = renderRuleDocs(plugins);
      const directory = resolve(cwd, args.out);
      const path = relative(cwd, directory);
      const shown = path.startsWith('..') ? directory : path || '.';

      if (args.check) {
        const { changed, removed } = await RuleDocsService.diff(directory, files);
        if (!changed.length && !removed.length) {
          console.log(`The rule docs in ${shown} are up to date.`);
          return EXIT_CODES.ok;
        }
        for (const path of changed) {
          console.log(`${shown}/${path} is out of date.`);
        }
        for (const path of removed) {
          console.log(`${shown}/${path} is no longer generated.`);
        }
        logger.warn(`Run pilotlint rules docs --out ${shown} to update the rule docs.`);
        return EXIT_CODES.findings;
      }

      const { changed, removed } = await RuleDocsService.write(directory, files);
      const updates = [
        ...changed.map((path) => `wrote ${path}`),
        ...removed.map((path) => `removed ${path}`),
      ];
      console.log(
        updates.length
          ? `Rule docs in ${shown}: ${updates.join(', ')}.`
          : `The rule docs in ${shown} are up to date.`,
      );
      return EXIT_CODES.ok;
    }),
});
