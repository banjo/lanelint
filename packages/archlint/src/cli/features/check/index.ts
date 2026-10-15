import { check as runCheck, type FailOn } from '@archlint/core';
import { defineCommand } from 'citty';
import { formatCompact } from '../../../reporters/compactReporter.ts';
import { formatJson } from '../../../reporters/jsonReporter.ts';
import { logger } from '../../logger.ts';
import { EXIT_CODES } from '../../constants/exitCodes.ts';
import { CommandService } from '../../services/commandService.ts';
import { ArgsUtil } from '../../utils/argsUtil.ts';
import { ConfigService } from '../../services/configService.ts';

export const check = defineCommand({
  meta: {
    name: 'check',
    description: 'Check the project structure. Pass files or directories to limit the report.',
  },
  args: {
    changed: {
      type: 'boolean',
      description: 'Only report on files that differ from the base ref',
    },
    new: {
      type: 'boolean',
      description: 'Only report findings that do not exist at the base ref',
    },
    base: {
      type: 'string',
      description: 'Base git ref for --changed, --new, and change rules (default: HEAD)',
    },
    rule: {
      type: 'string',
      description: 'Only run this rule. Repeat or separate ids with commas',
    },
    'fail-on': {
      type: 'enum',
      options: ['error', 'warn', 'never'],
      description: 'Exit with code 1 at this level (default: failOn from the config)',
    },
    format: {
      type: 'enum',
      options: ['compact', 'json'],
      default: 'compact',
      description: 'Output format',
    },
    'max-findings': {
      type: 'string',
      default: '50',
      description: 'Print at most this many findings in compact output',
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
      logger.debug(`Config ${config.configFile ?? '(inline)'}, root ${config.root}`);
      const base = args.base ?? 'HEAD';
      const failOn = args['fail-on'] as FailOn | undefined;
      const maxFindings = ArgsUtil.positiveInteger(args['max-findings'], 'max-findings', 50);
      const result = await runCheck({
        config,
        paths: args._,
        cwd,
        changed: args.changed,
        base,
        onlyNew: args.new,
        rules: ArgsUtil.repeated(rawArgs, 'rule'),
        failOn,
      });
      const options = { maxFindings, onlyNew: !!args.new, base };
      console.log(
        args.format === 'json' ? formatJson(result, options) : formatCompact(result, options),
      );
      return result.failed ? EXIT_CODES.findings : EXIT_CODES.ok;
    }),
});
