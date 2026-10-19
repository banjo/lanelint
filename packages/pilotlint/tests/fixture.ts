import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../../..');
const cli = resolve(here, '../src/cli/index.ts');

export interface CliResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface Fixture {
  readonly root: string;
  run(...args: string[]): CliResult;
  write(files: Readonly<Record<string, string>>): void;
  commit(): void;
  remove(): void;
}

const git = (cwd: string, args: readonly string[]) =>
  execFileSync(
    'git',
    ['-c', 'user.name=pilotlint', '-c', 'user.email=pilotlint@example.com', ...args],
    {
      cwd,
      stdio: 'pipe',
    },
  );

/**
 * A temporary git repository with the files of an example project, or extra files.
 * `node_modules` links to the example's dependencies so configs can import pilotlint.
 */
export function createFixture(
  example: string,
  files: Readonly<Record<string, string>> = {},
): Fixture {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pilotlint-cli-')));
  const source = join(repository, 'examples', example);
  cpSync(source, root, {
    recursive: true,
    filter: (path) => !path.includes('node_modules'),
  });
  // Its own node_modules with links to the packages, so each fixture has its own cache.
  mkdirSync(join(root, 'node_modules'));
  for (const entry of readdirSync(join(source, 'node_modules'))) {
    if (entry !== '.cache') {
      symlinkSync(join(source, 'node_modules', entry), join(root, 'node_modules', entry));
    }
  }
  const fixture: Fixture = {
    root,
    run: (...args) => {
      const result = spawnSync(process.execPath, [cli, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      });
      return { status: result.status, stdout: result.stdout, stderr: result.stderr };
    },
    write: (entries) => {
      for (const [path, content] of Object.entries(entries)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
      }
    },
    commit: () => {
      git(root, ['add', '-A']);
      git(root, ['commit', '--quiet', '--allow-empty', '-m', 'commit']);
    },
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
  fixture.write(files);
  git(root, ['init', '--quiet']);
  fixture.commit();
  return fixture;
}
