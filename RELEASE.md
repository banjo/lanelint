# Releasing

lanelint is released with [Changesets](https://github.com/changesets/changesets). Every
package is published to the public npm registry, `https://registry.npmjs.org/`.

## The registry

The npm registry may be set to something else on your machine, for example an internal
mirror in `NPM_CONFIG_REGISTRY`. Every command that talks to npm must therefore name the
public registry:

- For `npm` commands, pass `--registry https://registry.npmjs.org/`.
- For tools that call npm themselves, such as `pnpm changeset publish`, set both spellings of
  the variable in front of the command, since an existing uppercase variable would otherwise
  win:

  ```bash
  NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ npm_config_registry=https://registry.npmjs.org/ <command>
  ```

Run plain `npm` commands outside the repository, for example from your home directory. The
repository requires pnpm through `devEngines`, so npm refuses to run inside it.

## Once per machine

1. Log in to the public registry with both npm and pnpm:

   ```bash
   cd ~ && npm login --registry https://registry.npmjs.org/
   cd ~ && pnpm login --registry https://registry.npmjs.org/
   ```

   They keep separate logins: npm in `~/.npmrc`, pnpm in `~/.config/pnpm/config.yaml`.
   `pnpm changeset publish` publishes with pnpm, so it uses the pnpm login. The npm login is
   for the `npm` commands below.

2. Check that you are logged in and can publish to the `@lanelint` scope:

   ```bash
   cd ~ && npm whoami --registry https://registry.npmjs.org/
   cd ~ && pnpm whoami --registry https://registry.npmjs.org/
   cd ~ && npm org ls lanelint --registry https://registry.npmjs.org/
   ```

   Your user must be in the organization, with permission to publish its packages. The
   unscoped `lanelint` package belongs to a user account, not the organization, so publishing
   it needs that account or an owner of the package.

Publishing requires two-factor authentication, so keep your authenticator app at hand.

## 1. Describe each change

Every change to a package needs a changeset. `lanelint check` in this repository reports
`changes/requires-change` when files in `packages/*/src` changed without one.

```bash
pnpm changeset
```

Pick the packages, the bump type, and write one or two sentences for the changelog. Or write
the file by hand in `.changeset/`:

```md
---
'@lanelint/core': minor
'lanelint': patch
---

`defineConfig` knows the rules of plugins in `extends`.
```

Bump types while the version is below 1.0:

| Bump    | Use for                                           |
| ------- | ------------------------------------------------- |
| `patch` | Bug fixes and internal changes                    |
| `minor` | New features, and breaking changes before 1.0     |
| `major` | Breaking changes after 1.0; do not use before 1.0 |

Commit the changeset together with the change.

All packages share one version: they are a `fixed` group in `.changeset/config.json`, so a
changeset for one package bumps them all.

## 2. Check that main is ready

```bash
git switch main && git pull
git status            # must be clean
pnpm ready            # vp check, all tests, and lanelint on this repository
pnpm docs:rules --check
```

If `pnpm docs:rules --check` fails, run `pnpm docs:rules` and commit the result.

## 3. Bump the versions

```bash
pnpm changeset version
```

This consumes the files in `.changeset/`, bumps the versions in each `package.json`, updates
internal dependencies, and writes each package's `CHANGELOG.md`. Review the diff, then:

```bash
pnpm exec vp check --fix
git add -A
git commit -m "chore: release <version>"
git push
```

## 4. Publish

Build everything first, so the build steps that run during publishing hit the cache and the
publish finishes within the lifetime of one 2FA code:

```bash
pnpm exec vp run -r build
```

Then publish with a fresh code from your authenticator app:

```bash
NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ npm_config_registry=https://registry.npmjs.org/ pnpm changeset publish --otp=<code>
```

Changesets publishes every package whose version is not on the registry yet, then creates a
git tag per package, such as `lanelint@0.0.1`. Push the tags:

```bash
git push --follow-tags
```

## 5. Verify

New versions can take a few minutes to show up. Check the versions:

```bash
cd ~ && npm view lanelint version --registry https://registry.npmjs.org/
cd ~ && npm view @lanelint/core version --registry https://registry.npmjs.org/
```

Then install the release in an empty directory and run it:

```bash
mkdir /tmp/lanelint-release && cd /tmp/lanelint-release && git init -q
echo '{ "type": "module" }' > package.json
npm install -D lanelint @lanelint/plugin-boundaries --registry https://registry.npmjs.org/
npx --registry https://registry.npmjs.org/ lanelint --version
```

## Troubleshooting

| Problem                                                    | What to do                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EOTP` or an expired code during publish                   | Run the publish command again with a new code. Changesets skips the packages that are already published.                                                                                                                     |
| `ENEEDAUTH` or `need auth`                                 | You are not logged in to the public registry. Run `npm login` and `pnpm login` with `--registry`, as above.                                                                                                                  |
| `E404` for `@lanelint/...` during publish                  | Your pnpm login is missing or expired; run `pnpm login` with `--registry`, as above. Or you are not a member of the `lanelint` organization, or the registry variables are missing, so the publish went to another registry. |
| `E404` for a new version or tarball right after publishing | The registry has not caught up yet. Wait a few minutes. Brand-new packages took about five minutes for the first release.                                                                                                    |
| `EBADDEVENGINES` from npm                                  | You ran `npm` inside the repository. Run it from another directory.                                                                                                                                                          |
| A version shows as `0.0.0-stage`                           | npm's placeholder for a new package. It disappears from `latest` when the real version is live. See [staged publishing](https://docs.npmjs.com/staged-publishing/).                                                          |

A published version can never be published again, even after it is unpublished. If a release
is broken, fix it and release a new patch version.
