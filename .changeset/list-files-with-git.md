---
'@pilotlint/core': patch
---

In a git repository, pilotlint asks git for the project files instead of walking the directories, so files that git ignores are left out without listing them in `ignore`. Changes against `HEAD` come from `git diff` and the same list of untracked files, so git scans the working tree once per run. Set `gitignore: false` in the config to walk the directories instead. Outside git, pilotlint always walks them.
