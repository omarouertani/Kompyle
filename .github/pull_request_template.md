<!--
PR title: Conventional Commits, e.g. "feat(export): add LinkedIn export" (it becomes the squash commit on main).
Branch:   <type>/<kebab-case-name>, e.g. feat/linkedin-export (type: feat, fix, refactor, docs, chore).
-->

## What

<!-- What changed. -->

## Why

<!-- Why this change is needed. Link the issue: Fixes #123 -->

## Release

- `release.json` entry: version `x.y.z`, type `feature` | `fix`

## How it was tested

<!-- Steps, screenshots or GIFs for UI changes (fictional data only). Mention anything not tested. -->

## Checklist

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run release:check` and `npm run build` pass
- [ ] UI text added to both `messages/en.json` and `messages/fr.json`
- [ ] Fictional data only, no secrets or `.env*` files
- [ ] README updated if behavior, settings or structure changed
