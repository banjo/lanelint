/** Sizes of a generated project with features that import domains and each other. */
export interface ProjectSize {
  readonly features: number;
  readonly filesPerFeature: number;
  readonly domains: number;
  readonly filesPerDomain: number;
}

/** About 1,000 files, the size the performance targets in the plan are set for. */
export const LARGE: ProjectSize = {
  features: 20,
  filesPerFeature: 40,
  domains: 10,
  filesPerDomain: 20,
};

const plugins = `import boundaries from '@lanelint/plugin-boundaries';
import changes from '@lanelint/plugin-changes';
import conventions from '@lanelint/plugin-conventions';
import { defineConfig } from 'lanelint';
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

/**
 * A project with two configs: `lanelint.config.ts` has rules that need the whole project, and
 * `fast.config.ts` only rules that look at one file at a time.
 */
export function generateProject(size: ProjectSize): Record<string, string> {
  const files: Record<string, string> = {
    'lanelint.config.ts': `${plugins}
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
  for (let domain = 0; domain < size.domains; domain++) {
    const root = `src/common/domain-${domain}`;
    const models = Array.from({ length: size.filesPerDomain - 1 }, (_, index) => `model${index}`);
    files[`${root}/index.ts`] = models
      .map((model) => `export * from './models/${model}.ts';`)
      .join('\n');
    for (const model of models) {
      files[`${root}/models/${model}.ts`] =
        `export interface ${model}Value {\n  id: string;\n}\n\nexport const ${model}${domain} = (value: ${model}Value) => value.id;\n`;
    }
  }
  const main: string[] = [];
  for (let feature = 0; feature < size.features; feature++) {
    const root = `src/features/feature-${feature}`;
    const components = Array.from(
      { length: size.filesPerFeature - 1 },
      (_, index) => `component${index}`,
    );
    files[`${root}/index.ts`] = components
      .map((component) => `export { ${component}${feature} } from './components/${component}.ts';`)
      .join('\n');
    components.forEach((component, index) => {
      const domain = (feature + index) % size.domains;
      const model = index % (size.filesPerDomain - 1);
      const sibling = components[index + 1];
      files[`${root}/components/${component}.ts`] = [
        `import { model${model}${domain} } from '../../../common/domain-${domain}/index.ts';`,
        ...(sibling ? [`import { ${sibling}${feature} } from './${sibling}.ts';`] : []),
        ...(feature > 0 && index === 0
          ? [`import { component0${feature - 1} } from '../../feature-${feature - 1}/index.ts';`]
          : []),
        '',
        `export const ${component}${feature} = () => [model${model}${domain}];`,
      ].join('\n');
    });
    main.push(`export * from './features/feature-${feature}/index.ts';`);
  }
  files['src/main.ts'] = main.join('\n');
  return files;
}

/** Edits three source files, as a small change by an agent would. */
export const CHANGES: Readonly<Record<string, string>> = {
  'src/features/feature-1/components/component2.ts':
    '// changed\nexport const component21 = () => [];\n',
  'src/features/feature-2/components/component1.ts':
    '// changed\nexport const component12 = () => [];\n',
  'src/common/domain-1/models/model2.ts': '// changed\nexport const model21 = () => 1;\n',
};
