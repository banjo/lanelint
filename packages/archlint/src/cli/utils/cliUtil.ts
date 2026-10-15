import { ConfigError, UsageError } from '@archlint/core';
import { logger } from '../logger.ts';

/** Exit codes: 0 no failing findings, 1 failing findings, 2 usage or config problem. */
const exit = { ok: 0, findings: 1, setup: 2 } as const;

/** Runs a command body and maps setup problems to exit code 2. */
const run = async (body: () => Promise<number>): Promise<void> => {
  try {
    process.exitCode = await body();
  } catch (error) {
    if (error instanceof ConfigError || error instanceof UsageError) {
      logger.error(error.message);
    } else {
      logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    }
    process.exitCode = exit.setup;
  }
};

/** Values of a repeatable flag such as `--rule a --rule b,c`. */
const repeated = (rawArgs: readonly string[], name: string): string[] => {
  const values: string[] = [];
  rawArgs.forEach((arg, index) => {
    if (arg === `--${name}`) {
      values.push(rawArgs[index + 1] ?? '');
    } else if (arg.startsWith(`--${name}=`)) {
      values.push(arg.slice(name.length + 3));
    }
  });
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
};

const positiveInteger = (value: string | undefined, name: string, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new UsageError(`--${name} must be a whole number, got "${value}".`);
  }
  return number;
};

export const CliUtil = {
  exit,
  positiveInteger,
  repeated,
  run,
};
