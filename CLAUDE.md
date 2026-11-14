## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Working on Kompyle (rules for AI agents)

Read these rules before changing code. They apply to every task (feature, fix, refactor) and they are **mandatory before any commit or push**.

### 1. Branch and scope
- Never commit to `main`. Branch off an up-to-date `main`: `feat/<short-name>`, `fix/<short-name>`, `refactor/…`, `docs/…`, `chore/…`.
- One logical change per branch / pull request. Commit only when the user asks.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(canvas): …`, `fix(ai): …`.

### 2. Classify the change: feature or fix
| The change… | Type |
| --- | --- |
| gives users something new they can see or do (new button, panel, export, AI action, setting) | **feature** |
| repairs a bug, refactors, speeds up, updates docs or dependencies **without** a new visible capability | **fix** |

When in doubt, ask the user.

### 3. Update `release.json` (always, before pushing)
`release.json` (repo root) is the single source of the app version, the "Update available" badge of self-hosted instances and the "What's new" tour. `npm run release:check` validates it.

1. **Is the top entry already released?** Compare with `main`: `git show origin/main:release.json`.
   - The top version **is** on `main` → add a **new entry at the top**.
   - The top version is **not** on `main` yet (pending release on this branch or another open PR) → **extend that entry** instead of creating another version. If you add a feature to a pending `fix` entry, change it to `feature` and bump it to the next **minor**.
2. **Version** ([semver](https://semver.org)): feature → next **minor** (`0.2.0` → `0.3.0`); fix → next **patch** (`0.2.0` → `0.2.1`). Set the **same version in `package.json`**.
3. **Fields**: `version`, `date` (YYYY-MM-DD), `type` (`feature` | `fix`), `summary` `{ fr, en }`: one sentence that users understand.
4. **For a feature**, add one object per user-visible capability to `features`:
   ```json
   { "id": "linkedin-export", "target": "export",
     "title": { "fr": "Export LinkedIn", "en": "LinkedIn export" },
     "body":  { "fr": "Copiez votre CV au format <b>LinkedIn</b>.", "en": "Copy your CV in <b>LinkedIn</b> format." } }
   ```
   - `body` is shown in the guided tour: 1–3 short sentences that say **what** it does and **how** to use it. Only `<b>`, `<br>`, `<ul>/<ol>/<li>` HTML.
   - `target` is the `data-tour` value of the element to highlight. Add `data-tour="kebab-name"` to that element if it does not exist (unique, stable). Omit `target` to show the step in the center of the screen.
   - These features are shown **once** to existing users after they update, and are appended to the full guided tour for new users. No other code is needed.
5. **For a fix**: no `features` array.
6. Never edit or delete entries that are already on `main`.

### 4. Guided tour
- The base tour (`STEPS` in `src/components/OnboardingTour.tsx`, texts in `messages/*.json` › `Tour`) covers the UI as of v0.2.0. **New features go in `release.json`, not in `STEPS`.**
- If you change, move or remove a UI element that a base step or a feature targets (`data-tour`), update that step's text, its `target`, or the `release.json` entry, and run `npm run release:check` (it fails on unknown targets).

### 5. Code conventions that must be kept
- **No hard-coded user-visible text.** Add every string to **both** `messages/fr.json` and `messages/en.json` with the same keys. Text printed **inside the CV** (section titles, contact labels…) goes in the `CVDocument` namespace and follows the CV's language (`src/lib/cv-i18n.ts`), not the UI language.
- **Menus and popovers**: use the `popover-surface` class and the `useDismiss` hook (`src/hooks/use-dismiss.ts`) so they close on outside click and <kbd>Esc</kbd>. Dialogs use `src/components/ui/alert-dialog.tsx` (closes on backdrop click).
- **Canvas**: the page re-stacks itself when the CV structure changes (`use-canvas-pagination.ts`); do not add manual position fixes for added/removed items.
- **AI routes**: call providers through `callWithFallback` (timeouts and fallback), parse with `extractAndValidate(raw, schema, source)` (fills sections a model omitted), re-impose immutable fields, and keep `enforceExperienceYears` on CV/letter output (the AI must never change the number of years of experience).
- Use **fictional data only** (Jane Doe). Never commit secrets, `.env*`, real CVs or API keys.
- New environment variable → document it in `.env.example`, `docker-compose.yml` and the README **Configuration** table.

### 6. Checks before pushing
```bash
npx tsc --noEmit
npm run lint            # no new errors
npm run release:check
npm run build           # for larger changes
graphify update .       # keep the knowledge graph current (if graphify is installed)
```

### 7. Docs
Update the README (**Features**, **Configuration**, **Architecture**, **Scripts**) when behavior, settings or structure change. Screenshots are refreshed by the maintainer: if your change makes one outdated, say so in the PR description.

### 8. Pull request
Describe **what** changed and **why**, the `release.json` entry (version + type), how it was tested, and anything not tested.
