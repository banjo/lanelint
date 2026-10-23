import { styleText } from 'node:util';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];
type Format = Parameters<typeof styleText>[0];

const isLogLevel = (value: string): value is LogLevel => LOG_LEVELS.includes(value as LogLevel);

let globalLevel: LogLevel = isLogLevel(process.env.LOG_LEVEL?.toLowerCase() ?? '')
  ? (process.env.LOG_LEVEL?.toLowerCase() as LogLevel)
  : 'info';

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

const shouldLog = (level: LogLevel) => LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(globalLevel);

/** Colors text for stdout. Colors are dropped when stdout is not a TTY or NO_COLOR is set. */
export const color = (format: Format, text: string) =>
  styleText(format, text, { stream: process.stdout });

const colorError = (format: Format, text: string) =>
  styleText(format, text, { stream: process.stderr });

/** Diagnostics go to stderr so stdout stays clean for reports. */
export const logger = {
  debug(...lines: string[]) {
    if (shouldLog('debug')) {
      console.error(colorError('gray', lines.join(' ')));
    }
  },
  warn(...lines: string[]) {
    if (shouldLog('warn')) {
      console.error(colorError('yellow', lines.join(' ')));
    }
  },
  error(...lines: string[]) {
    if (shouldLog('error')) {
      console.error(colorError('red', lines.join(' ')));
    }
  },
};
