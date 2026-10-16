import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { createFixture, type Fixture } from './fixture.ts';

// Targets from the plan, on about 1,000 files. Slow CI machines can raise them with
// PILOTLINT_BUDGET_FACTOR instead of weakening the test.
const factor = Number(process.env.PILOTLINT_BUDGET_FACTOR ?? 1);
const FEATURES = 20;
const FILES_PER_FEATURE = 40;
const DOMAINS = 10;
const FILES_PER_DOMAIN = 20;

const plugins = `import boundaries from '@pilotlint/plugin-boundaries';
import changes from '@pilotlint/plugin-changes';
import conventions from '@pilotlint/plugin-conventions';
import { defineConfig } from 'pilotlint';
`;

const elements = `elements: [
    { type: 'feature', pattern: 'src/features/:name' },
    { type: 'domain', pattern: 'src/common/:name' },
  ],
  plugins: [boundaries, changes, conventions],`;

const fileRules = `'boundaries/entry-only': ['error', { elements: 'feature' }],
    'boundaries/allowed-imports': ['error', { rules: [{ from: 'domain', disallow: 'feature' }] }],
    'boundaries/no-unresolved': 'error',
    'conventions/directory-case': ['error', { case: 'kebab' }],
    'conventions/no-suppressions': 'error',
    'conventions/root-only-files': ['error', { names: ['index.ts'] }],`;

function generate(): Record<string, string> {
  const files: Record<string, string> = {
    'pilotlint.config.ts': `${plugins}
export default defineConfig({
  ${elements}
  rules: {
    ${fileRules}
    'boundaries/no-cycles': 'error',
    'boundaries/public-api': ['error', { elements: 'domain' }],
    'boundaries/no-orphans': ['warn', { roots: ['src/main.ts'] }],
    'changes/requires-change': ['error', { rules: [{ when: 'src/**/messages.ts', require: 'src/en.json' }] }],
  },
  overrides: [{ elements: ['feature', 'domain'], rules: { 'conventions/no-default-export': 'error' } }],
});
`,
    'fast.config.ts': `${plugins}
export default defineConfig({
  ${elements}
  rules: {
    ${fileRules}
  },
  overrides: [{ elements: ['feature', 'domain'], rules: { 'conventions/no-default-export': 'error' } }],
});
`,
  };
  for (let domain = 0; domain < DOMAINS; domain++) {
    const root = `src/common/domain-${domain}`;
    const models = Array.from({ length: FILES_PER_DOMAIN - 1 }, (_, index) => `model${index}`);
    files[`${root}/index.ts`] = models
      .map((model) => `export * from './models/${model}.ts';`)
      .join('\n');
    for (const model of models) {
      files[`${root}/models/${model}.ts`] =
        `export interface ${model}Value {\n  id: string;\n}\n\nexport const ${model}${domain} = (value: ${model}Value) => value.id;\n`;
    }
  }
  const main: string[] = [];
  for (let feature = 0; feature < FEATURES; feature++) {
    const root = `src/features/feature-${feature}`;
    const components = Array.from(
      { length: FILES_PER_FEATURE - 1 },
      (_, index) => `component${index}`,
    );
    files[`${root}/index.ts`] = components
      .map((component) => `export { ${component}${feature} } from './components/${component}.ts';`)
      .join('\n');
    components.forEach((component, index) => {
      const domain = (feature + index) % DOMAINS;
      const sibling = components[index + 1];
      files[`${root}/components/${component}.ts`] = [
        `import { model${index % (FILES_PER_DOMAIN - 1)}${domain} } from '../../../common/domain-${domain}/index.ts';`,
        ...(sibling ? [`import { ${sibling}${feature} } from './${sibling}.ts';`] : []),
        ...(feature > 0 && index === 0
          ? [`import { component0${feature - 1} } from '../../feature-${feature - 1}/index.ts';`]
          : []),
        '',
        `export const ${component}${feature} = () => [model${index % (FILES_PER_DOMAIN - 1)}${domain}];`,
      ].join('\n');
    });
    main.push(`export * from './features/feature-${feature}/index.ts';`);
  }
  files['src/main.ts'] = main.join('\n');
  return files;
}

interface Report {
  readonly summary: { readonly durationMs: number; readonly files: number };
}

const timed = (fixture: Fixture, ...args: string[]) => {
  const start = performance.now();
  const result = fixture.run(...args, '--format', 'json', '--fail-on', 'never');
  const wall = performance.now() - start;
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  const report = JSON.parse(result.stdout) as Report;
  return { engine: report.summary.durationMs, wall, files: report.summary.files };
};

describe('performance', () => {
  let fixture: Fixture;

  beforeAll(() => {
    fixture = createFixture('feature-folders', generate());
  });

  afterAll(() => fixture.remove());

  it('stays within the time budgets on about 1,000 files', () => {
    timed(fixture, 'check');
    const full = timed(fixture, 'check');
    fixture.write({
      'src/features/feature-3/components/component5.ts':
        '// changed\nexport const component53 = () => [];\n',
      'src/features/feature-7/components/component1.ts':
        '// changed\nexport const component17 = () => [];\n',
      'src/common/domain-2/models/model4.ts': '// changed\nexport const model42 = () => 1;\n',
    });
    const changed = timed(fixture, 'check', '--changed', '--config', 'fast.config.ts');
    const changedNew = timed(fixture, 'check', '--changed', '--new');
    console.log(
      `full ${Math.round(full.engine)} ms (${Math.round(full.wall)} ms wall, ${full.files} files), ` +
        `--changed ${Math.round(changed.engine)} ms (${Math.round(changed.wall)} ms wall), ` +
        `--changed --new ${Math.round(changedNew.engine)} ms (${Math.round(changedNew.wall)} ms wall)`,
    );
    expect(full.files).toBeGreaterThan(1000);
    expect(full.engine).toBeLessThan(1000 * factor);
    expect(changed.engine).toBeLessThan(300 * factor);
    expect(changedNew.engine).toBeLessThan(1500 * factor);
  });
});
