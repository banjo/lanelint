import type { FailOn, Level } from './finding.ts';
import type { AnyRule, Rule } from './rule.ts';

export interface ElementDefinition {
  readonly type: string;
  /** Directory pattern with `:capture` and `*` segments, for example `src/features/:name`. */
  readonly pattern: string;
  /** Allowed values per capture. */
  readonly where?: Readonly<Record<string, readonly string[]>>;
  /** Entry files relative to the element root. Defaults to `index` with any source extension. */
  readonly entry?: string | readonly string[];
  readonly description?: string;
}

/** A rule level, or a level with options. A level alone keeps options set earlier. */
export type RuleEntry<Input = unknown> =
  | Level
  | readonly [Level]
  | ([Input] extends [never] ? never : readonly [Level, Input]);

export type RulesConfig = Readonly<Record<string, RuleEntry | undefined>>;

export interface OverrideConfig<Rules = RulesConfig> {
  readonly description?: string;
  /** Globs matched against location paths. */
  readonly files?: readonly string[];
  readonly ignore?: readonly string[];
  /** Element types. */
  readonly elements?: readonly string[];
  readonly rules: Rules;
}

export interface Plugin<
  Name extends string = string,
  Rules extends Readonly<Record<string, AnyRule>> = Readonly<Record<string, AnyRule>>,
  ConfigName extends string = string,
> {
  readonly name: Name;
  /** One sentence about the plugin, shown by `pilotlint rules docs`. */
  readonly description?: string;
  readonly rules: Rules;
  readonly configs: Readonly<Record<ConfigName, ConfigFragment>>;
}

export type AnyPlugin = Plugin<string, Readonly<Record<string, AnyRule>>, string>;

/** A shareable piece of config, for example a plugin's `recommended` config. */
export interface ConfigFragment {
  readonly plugins?: readonly AnyPlugin[];
  readonly elements?: readonly ElementDefinition[];
  readonly rules?: RulesConfig;
  readonly overrides?: readonly OverrideConfig[];
}

type RuleInputOf<R> = R extends Rule<unknown, infer Input> ? Input : never;

type PluginRuleEntries<P> =
  P extends Plugin<infer Name, infer Rules, string>
    ? { [Key in keyof Rules & string as `${Name}/${Key}`]?: RuleEntry<RuleInputOf<Rules[Key]>> }
    : never;

type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;

export type CoreRuleId =
  | 'pilotlint/config-changed'
  | 'pilotlint/stale-config'
  | 'pilotlint/no-git'
  | 'pilotlint/parse-error';

type CoreRuleEntries = { [Key in CoreRuleId]?: RuleEntry<never> };

export type RulesFor<Plugins extends readonly AnyPlugin[]> = CoreRuleEntries &
  UnionToIntersection<PluginRuleEntries<Plugins[number]>>;

export interface PilotlintConfig<Plugins extends readonly AnyPlugin[] = readonly AnyPlugin[]> {
  /** Project root. Defaults to the directory of the config file. */
  readonly root?: string;
  /** Globs of files that belong to the project. Defaults to every file. */
  readonly include?: readonly string[];
  readonly ignore?: readonly string[];
  /** Globs of test files. */
  readonly tests?: readonly string[];
  readonly failOn?: FailOn;
  readonly elements?: readonly ElementDefinition[];
  readonly plugins?: Plugins;
  readonly extends?: readonly ConfigFragment[];
  readonly rules?: RulesFor<Plugins>;
  readonly overrides?: readonly OverrideConfig<RulesFor<Plugins>>[];
}
