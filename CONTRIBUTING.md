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
   Use a descriptive prefix: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`.

2. **Make your changes.** Keep them focused: one logical change per pull request.
   - UI text goes in **both** `messages/en.json` and `messages/fr.json`.
   - Use **fictional data only** (such as the built-in "Jane Doe") in code, tests and screenshots. Never commit a real CV, address, phone number or API key.
   - Do not add a dependency without explaining why in the pull request.

3. **Check your work** before committing:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```

## Commit Messages

Write clear, present-tense commit messages describing what the change does, following [Conventional Commits](https://www.conventionalcommits.org/):

```
fix(pdf): prevent canvas elements from clipping on export
feat(ai): add Mistral provider to the AI engine
```

## Submitting a Pull Request

1. Push your branch to your fork and open a Pull Request against `main`.
2. Describe **what** changed and **why**. Link any related issues (e.g. `Fixes #12`).
3. Include screenshots or GIFs for UI changes (using the sample data).
4. Make sure `npx tsc --noEmit`, `npm run lint` and `npm run build` pass.

A maintainer will review your PR. PRs are merged using **squash merge**, so your commit history within the branch does not need to be perfectly clean.

## Reporting Bugs & Requesting Features

Open an [issue](https://github.com/omarouertani/Kompyle/issues) with:

- A clear title and description
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Screenshots or logs where relevant (without personal data)

## Security Issues

Please **do not** open public issues for security vulnerabilities. See [`SECURITY.md`](SECURITY.md) for how to report them privately.

Thank you for helping make Kompyle better!
