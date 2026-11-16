# Contributing to Kompyle

Thanks for your interest in contributing to Kompyle! This document explains how to set up the project and submit changes.

## Code of Conduct

Be respectful and constructive. Harassment or abusive behavior will not be tolerated.

## Getting Started

**Requirements:** [Node.js 22](https://nodejs.org/) (see `.nvmrc`), npm, and optionally Docker for the database.

1. **Fork** the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/Kompyle.git
   cd Kompyle
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **(Optional) Start PostgreSQL** so that profiles can be saved. The schema is created automatically:
   ```bash
   npm run db:up
   npm run db:seed   # optional: the fictional "Jane Doe" sample profile
   ```

4. **Run the dev server** on http://localhost:3000:
   ```bash
   npm run dev
   ```

No environment variable and no AI key is required to start. To try the AI features, enter a key (Gemini and Groq have free tiers) in the **API Keys** dialog of the app. See the [README](README.md) for the full setup and the [`.env.example`](.env.example) for optional settings.

To check the Docker setup end to end, run `docker compose up --build`.

## Project layout

| Path | Contents |
| --- | --- |
| `src/app/api/` | Route handlers (AI actions, PDF / DOCX rendering, profiles) |
| `src/components/cv/` | Canvas editor, PDF templates, CV import, ATS checker |
| `src/lib/` | Layout engine, AI providers, CV import, skill levels, DOCX export |
| `src/schemas/` | Zod schemas (CV, cover letter, ATS result) |
| `messages/` | UI translations: `en.json` and `fr.json` |
| `scripts/` | Database schema (`init.sql`) and sample data |

## Making Changes

1. **Create a branch** off `main`:
   ```bash
   git checkout -b feat/short-description
   ```
   The name must be `<type>/<kebab-case-name>` with type `feat`, `fix`, `refactor`, `docs` or `chore` (for example `feat/linkedin-export`, `fix/pdf-clipping`). Other names fail the **PR conventions** check. Never push to `main` directly: every change goes through a pull request.

2. **Make your changes.** Keep them focused: one logical change per pull request.
   - UI text goes in **both** `messages/en.json` and `messages/fr.json`.
   - Use **fictional data only** (such as the built-in "Jane Doe") in code, tests and screenshots. Never commit a real CV, address, phone number or API key.
   - Do not add a dependency without explaining why in the pull request.
   - **Update [`release.json`](release.json)**: a `feature` entry for something users can see or do, a `fix` entry otherwise (see [Releasing a Version](#releasing-a-version)).

3. **Check your work** before committing:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run release:check
   npm run build
   ```

## Commit Messages

Write clear, present-tense commit messages describing what the change does, following [Conventional Commits](https://www.conventionalcommits.org/):

```
fix(pdf): prevent canvas elements from clipping on export
feat(ai): add Mistral provider to the AI engine
```

The **PR conventions** check rejects commits and pull request titles that do not follow `<type>(<scope>): <description>` (merge commits are allowed). Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, `build`, `ci`, `chore`, `revert`.

## Submitting a Pull Request

1. Push your branch to your fork and open a Pull Request against `main`.
2. Describe **what** changed and **why**. Link any related issues (e.g. `Fixes #12`).
3. Include screenshots or GIFs for UI changes (using the sample data).
4. Make sure `npx tsc --noEmit`, `npm run lint`, `npm run release:check` and `npm run build` pass.
5. Mention the `release.json` entry (version and type) in the description.

To be merged, a PR needs:

- the **CI** check (type check, lint, `release:check`, build) and the **PR conventions** check (branch name, PR title, commit messages) to pass;
- the approval of the maintainer ([@omarouertani](https://github.com/omarouertani), see [`.github/CODEOWNERS`](.github/CODEOWNERS)). Approvals from other accounts do not count, and a new push dismisses an earlier approval;
- all review conversations resolved.

PRs are merged using **squash merge**: the PR title becomes the commit on `main`, so it must describe the change. Workflows on PRs from forks run only after the maintainer approves them.

## Releasing a Version

Versions and release notes live in [`release.json`](release.json). It drives three things: the version shown in the app, the **“Update available”** badge that self-hosted instances display, and the **“What’s new”** tour.

1. Add the new version **at the top** of `releases`:
   - `"type": "feature"` when users get something new. List each feature in `features` with an `id`, a `title` and a `body` in **French and English**, and optionally a `target`: the `data-tour` value of the element to highlight (add a `data-tour="…"` attribute to that element if needed). These features are shown once to existing users after they update, and added to the full guided tour for new users.
   - `"type": "fix"` for bug fixes only: no `features`. Users are told an update is available, but no tour is shown.
2. Set the same version in `package.json` ([semver](https://semver.org): minor for features, patch for fixes).
3. Run `npm run release:check` (format, translations, `data-tour` targets, versions in sync).
4. Merge to `main`. Instances check `release.json` on `main`, so they see the update as soon as it is merged.

```json
{
  "version": "0.3.0",
  "date": "2026-12-01",
  "type": "feature",
  "summary": { "fr": "Export LinkedIn.", "en": "LinkedIn export." },
  "features": [
    {
      "id": "linkedin-export",
      "target": "export",
      "title": { "fr": "Export LinkedIn", "en": "LinkedIn export" },
      "body": { "fr": "Copiez votre CV au format <b>LinkedIn</b>.", "en": "Copy your CV in <b>LinkedIn</b> format." }
    }
  ]
}
```

## Reporting Bugs & Requesting Features

Open an [issue](https://github.com/omarouertani/Kompyle/issues) with:

- A clear title and description
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Screenshots or logs where relevant (without personal data)

## Security Issues

Please **do not** open public issues for security vulnerabilities. See [`SECURITY.md`](SECURITY.md) for how to report them privately.

Thank you for helping make Kompyle better!
