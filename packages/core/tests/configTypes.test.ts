import { describe, expect, expectTypeOf, it } from 'vite-plus/test';
import * as v from 'valibot';
import {
  defineConfig,
  defineConfigFragment,
  definePlugin,
  defineRule,
  type LanelintConfig,
  type RuleEntry,
} from '../src/index.ts';

const alpha = definePlugin({
  name: 'alpha',
  rules: {
    'with-options': defineRule({
      meta: { description: 'A rule with options.', severity: 'error' },
      options: v.object({ limit: v.number() }),
      create: () => ({}),
    }),
  },
  configs: { recommended: { rules: { 'alpha/with-options': ['error', { limit: 1 }] } } },
});

const beta = definePlugin({
  name: 'beta',
  rules: {
    plain: defineRule({
      meta: { description: 'A rule without options.', severity: 'warn' },
      create: () => ({}),
    }),
  },
});

/** The rule entries a config accepts. */
type RulesOfConfig<Config> =
  Config extends LanelintConfig<infer Plugins, infer Extends>
    ? NonNullable<LanelintConfig<Plugins, Extends>['rules']>
    : never;

describe('config types', () => {
  it('knows the rules of plugins in plugins', () => {
    const config = defineConfig({
      plugins: [alpha, beta],
      rules: { 'alpha/with-options': ['error', { limit: 2 }], 'beta/plain': 'warn' },
    });
    expectTypeOf<RulesOfConfig<typeof config>>().toHaveProperty('beta/plain');
    expectTypeOf<RulesOfConfig<typeof config>>().not.toHaveProperty('beta/nope');
    expect(config.plugins).toHaveLength(2);
  });

  it('knows the rules and options of plugins in extends', () => {
    const config = defineConfig({
      extends: [alpha.configs.recommended],
      rules: { 'alpha/with-options': ['warn', { limit: 2 }] },
      overrides: [{ files: ['src/**'], rules: { 'alpha/with-options': 'off' } }],
    });
    type Rules = RulesOfConfig<typeof config>;
    expectTypeOf<Rules['alpha/with-options']>().toEqualTypeOf<
      RuleEntry<{ limit: number }> | undefined
    >();
    expectTypeOf<Rules>().not.toHaveProperty('beta/plain');
    expect(config.extends).toHaveLength(1);
  });

  it('knows the rules of plugins in shared fragments', () => {
    const shared = defineConfigFragment({ plugins: [beta], rules: { 'beta/plain': 'error' } });
    const config = defineConfig({
      plugins: [alpha],
      extends: [shared],
      rules: { 'alpha/with-options': ['error', { limit: 3 }], 'beta/plain': 'off' },
    });
    type Rules = RulesOfConfig<typeof config>;
    expectTypeOf<Rules>().toHaveProperty('alpha/with-options');
    expectTypeOf<Rules>().toHaveProperty('beta/plain');
    expectTypeOf<Rules>().not.toHaveProperty('beta/nope');
  });
});
