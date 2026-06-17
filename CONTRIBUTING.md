# Contributing to Kompyle

Thanks for your interest in contributing to Kompyle! This document explains how to set up the project and submit changes.

## Code of Conduct

Be respectful and constructive. Harassment or abusive behavior will not be tolerated.

## Getting Started

1. **Fork** the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/Kompyle.git
   cd Kompyle
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **(Optional) Start the database**:
   ```bash
   npm run db:up
   ```

4. **Run the dev server**:
   ```bash
   npm run dev
   ```

See the [README](README.md) for full setup details and prerequisites.

## Making Changes

1. **Create a branch** off `main`:
   ```bash
   git checkout -b feat/short-description
   ```
   Use a descriptive prefix: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`.

2. **Make your changes.** Keep them focused — one logical change per pull request.

3. **Lint before committing**:
   ```bash
   npm run lint
   ```

4. **Verify the build passes**:
   ```bash
   npm run build
   ```

## Commit Messages

Write clear, present-tense commit messages describing what the change does, e.g.:

```
fix: prevent canvas elements from clipping on PDF export
feat: add Mistral provider to the AI engine
```

## Submitting a Pull Request

1. Push your branch to your fork and open a Pull Request against `main`.
2. Describe **what** changed and **why**. Link any related issues (e.g. `Fixes #12`).
3. Include screenshots or GIFs for UI changes when possible.
4. Make sure `npm run lint` and `npm run build` pass.

A maintainer will review your PR. PRs are merged using **squash merge**, so your commit history within the branch does not need to be perfectly clean.

## Reporting Bugs & Requesting Features

Open an [issue](https://github.com/omarouertani/Kompyle/issues) with:

- A clear title and description
- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Screenshots or logs where relevant

## Security Issues

Please **do not** open public issues for security vulnerabilities. See [`SECURITY.md`](SECURITY.md) for how to report them privately.

Thank you for helping make Kompyle better!
