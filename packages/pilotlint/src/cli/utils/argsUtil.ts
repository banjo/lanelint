import { UsageError } from '@pilotlint/core';

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

/** Parses a flag value as a whole number, or returns the fallback when the flag is missing. */
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

export const ArgsUtil = {
  positiveInteger,
  repeated,
};
