# Agents

pilotlint is built to run after every change an agent makes. It is fast enough for that,
and `--new` shows the agent only the problems it caused. Set up three things: the skill, a
hook after edits, and a check before commits and in CI.

## The skill

The `pilotlint` package ships an agent skill at
`node_modules/pilotlint/skills/pilotlint/SKILL.md`. It tells the agent to:

1. Run `pilotlint describe <path>` before it creates files in an area it does not know.
2. Run `pilotlint check --changed --new` after every change, and fix what it reports.
3. Run `pilotlint rules explain <id>` when it does not understand a finding.
4. Fix the code instead of changing the config or adding suppression comments.
5. Stop and ask a human when it sees `pilotlint/config-changed`.
6. Report exit code `2` to a human instead of working around it.
7. Run the type check, lint, and tests too, since pilotlint only checks structure.

Copy the skill into your agent's skills directory, for example `.claude/skills/pilotlint/`
or `.agents/skills/pilotlint/`, or point your agent instructions at it.

The skill is the same for every project. What is specific to your project comes from the
config: `describe` shows the structure, `rules explain` the rule docs, and each finding has a
hint.

## A hook after edits

A hook runs pilotlint after each edit, so the agent does not have to remember it.

**Claude Code**, in `.claude/settings.json`. Exit code `2` from a hook shows its output to the
agent:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx pilotlint check --new \"$(jq -r '.tool_input.file_path')\" 1>&2; [ $? -ne 1 ] || exit 2"
          }
        ]
      }
    ]
  }
}
```

**OpenCode**: a plugin can run the same command after the `edit` and `write` tools. See the
[OpenCode plugin docs](https://opencode.ai/v2/docs/build/plugins) for the hook events.

The hook passes the edited file, so the report covers that file and the findings it is part
of, such as a cycle through it.

## Before commits and in CI

Check what a commit changes before it is made. With Vite+, in `vite.config.ts`:

```ts
export default defineConfig({
  staged: {
    '*': ['pilotlint check --changed --new'],
  },
});
```

In CI, compare with the main branch:

```bash
pilotlint check --base origin/main --new
```

## Keeping the config in human hands

The config decides what is allowed, so an agent that changes it can make any finding go
away. Two things guard against that:

- `pilotlint/config-changed` warns whenever the config differs from the base ref. The skill
  tells the agent to stop and ask a human.
- Findings have hints that say how to fix the code, and rule docs explain why the rule
  exists, so the agent has a better option than changing the config.

Code review stays the last guard: treat every change to `pilotlint.config.ts` like a change to
the rules of the project.
