# Changesets

Every change to a published package needs a changeset, which describes the change for the
changelog and decides the version bump. Run `pnpm changeset` and commit the generated file.

lanelint checks this itself: `changes/requires-change` in `lanelint.config.ts` reports source
changes in `packages/*/src` without a changeset.
