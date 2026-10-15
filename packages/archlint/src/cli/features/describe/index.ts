import { relative, resolve } from 'node:path';
import { describeProject, UsageError } from '@archlint/core';
import { defineCommand } from 'citty';
import { formatMarkdown } from '../../../reporters/markdownReporter.ts';
import { CliUtil } from '../../utils/cliUtil.ts';
import { ConfigUtil } from '../../utils/configUtil.ts';

export const describe = defineCommand({
  meta: {
    name: 'describe',
    description: 'Describe the configured structure, or what applies to one path',
  },
  args: {
    path: {
      type: 'positional',
      required: false,
      description: 'A file or directory, which does not have to exist yet',
    },
    format: {
      type: 'enum',
      options: ['markdown', 'json'],
      default: 'markdown',
      description: 'Output format',
    },
    config: {
      type: 'string',
      description: 'Path to the config file',
    },
  },
  run: ({ args }) =>
    CliUtil.run(async () => {
      const cwd = process.cwd();
      const config = await ConfigUtil.load({ cwd, config: args.config });
      let path: string | undefined;
      if (args.path !== undefined) {
        path = relative(config.root, resolve(cwd, args.path)).split('\\').join('/');
        if (path.startsWith('..')) {
          throw new UsageError(`${args.path} is outside the project root ${config.root}.`);
        }
      }
      const description = await describeProject(config, { path });
      console.log(
        args.format === 'json' ? JSON.stringify(description, null, 2) : formatMarkdown(description),
      );
      return CliUtil.exit.ok;
    }),
});
