<div align="center">
  <img src="public/logo.svg" alt="Kompyle" height="56">

  <p><b>An open-source, privacy-first CV editor with a drag-and-drop canvas, AI you bring yourself, and a built-in ATS checker.</b></p>

  <p>
    <a href="#quick-start-docker">Quick start</a> •
    <a href="#features">Features</a> •
    <a href="#screenshots">Screenshots</a> •
    <a href="#ai-providers-bring-your-own-key">AI providers</a> •
    <a href="#privacy">Privacy</a> •
    <a href="#local-development">Development</a> •
    <a href="#configuration">Configuration</a> •
    <a href="#contributing">Contributing</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16">
    <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black" alt="React 19">
    <img src="https://img.shields.io/badge/Node.js-22-5fa04e?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 22">
    <img src="https://img.shields.io/badge/Docker-ready-2496ed?style=flat-square&logo=docker&logoColor=white" alt="Docker ready">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
  </p>
</div>

<p align="center">
  <img src="docs/screenshots/editor-light.webp" alt="The Kompyle editor: a CV on a canvas, with the AI panel on the left" width="900">
</p>

**Kompyle** lets you build a CV the way you would in a design tool: every block sits on a canvas that maps one-to-one to the exported PDF, and you edit everything directly on the page. Import the CV you already have (it is kept in French and English), tailor it to a job offer with the AI assistant and the provider of your choice, write the cover letter, check how an Applicant Tracking System (ATS) will read it, and export it as PDF, Word or plain text.

The app ships with a **fictional sample CV (Jane Doe)**, so you can try everything before entering any personal data.

---

## Quick start (Docker)

The only requirement is [Docker](https://docs.docker.com/get-docker/) with Compose. No account, no API key and no configuration file are needed.

```bash
git clone https://github.com/omarouertani/Kompyle.git
cd Kompyle
docker compose up --build
```

Then open **http://localhost:3000**.

`docker compose up` starts two containers:

| Service | Image | Role |
| --- | --- | --- |
| `app` | built from the [`Dockerfile`](Dockerfile) (Node 22, Next.js standalone output) | The web app on port `3000` |
| `db` | `postgres:16-alpine` | Stores your profiles in the `pgdata` volume; the schema ([`scripts/init.sql`](scripts/init.sql)) is created automatically on first start |

The app waits for the database to be healthy before starting. Your data survives restarts and rebuilds.

<details>
<summary><b>Useful commands</b></summary>

```bash
docker compose up --build -d                  # start in the background
docker compose logs -f app                    # follow the app logs
docker compose --profile seed run --rm seed   # optional: load the fictional "Jane Doe" profile
docker compose down                           # stop (your data is kept)
docker compose down -v                        # stop and DELETE the database volume
```

If port `3000` or `5432` is already taken, change it without editing any file:

```bash
APP_PORT=3100 DB_PORT=5433 docker compose up --build
```

</details>

### Updating

When a new version is published, Kompyle shows an **“Update vX.Y.Z”** badge in the header with the release notes and the command to run. In the project folder:

```bash
git pull && docker compose up -d --build
```

Your profiles are kept (they live in the `pgdata` volume). After the update, a short **“What’s new”** tour shows only the new features; bug-fix releases update silently. The check reads the public [`release.json`](release.json) from GitHub once every 6 hours and sends no data; turn it off with `KOMPYLE_UPDATE_CHECK=false`.

> [!NOTE]
> Without a database the app still works: you can edit and export, but profiles are not saved. This is what happens if you run the app alone (`npm run dev` without PostgreSQL).

> [!TIP]
> The database password defaults to `kompyle_dev`, and PostgreSQL is only published on `127.0.0.1`. If you deploy Kompyle on a server, set your own `POSTGRES_PASSWORD` (see [Configuration](#configuration)) before the first `docker compose up`.

---

## Features

### AI assistant (bring your own key)
- **One AI panel, built like a chat**: paste a job offer and click **Adapt CV** to get a new version of your CV tailored to it (keywords, summary, achievements), or **Create Letter** for the cover letter. Each request and answer appears in the conversation, with quick actions: *View the CV*, *Check the ATS*, *Write the letter*.
- **Refine in one sentence**: after a result, ask for changes ("shorten the summary", "highlight React") or click a **suggestion**. Changes apply to the version shown, without creating a copy.
- **Compare** an adapted CV with the original and switch between versions; each job offer gets its own version.
- **Guardrails**: emails, phone numbers, dates, locations and skill levels are locked and re-imposed after the AI answers, and **the number of years of experience written in your CV can never be changed** by the AI.
- **Robust with free models**: partial answers are completed from your CV instead of failing, prompts are compact enough for small free quotas, and every AI call has a timeout (90 s) with automatic fallback to another model of the same provider.

### Edit everything on the page
- **Free-form canvas** that maps one-to-one to the PDF: click any text to type, drag, resize and align blocks with snapping guides, multi-select (lasso, <kbd>Shift</kbd>-click), zoom and pan.
- **Right-click** any item to **add** a new one (even in an empty section), **duplicate**, **move up / down**, delete it or hide its section. The page **re-lays itself out automatically** when you add or remove something: no overlaps, no gaps.
- **Sections** button: show, hide and rename sections, or add a free section. **Layers** panel: reorder sections by column.
- **Photo, languages and contact fields** are edited on the canvas too (change / crop / remove the photo, add a language, add a portfolio or date of birth).
- **Rich text** (Tiptap): bold, italic, underline, lists, links, alignment, fonts and sizes, highlight, line and letter spacing.
- **Theme panel**: palettes, colors, fonts, sizes, spacing, skill style (text, tags, 1–5 bars) and photo frame.
- **7 templates** (Without photo, With photo, Canadian, Elegant, Minimal, Creative, Executive), **A4 or US Letter**, multi-page layout, **undo / redo**.

### Bilingual CV (French / English)
- The interface **and** the CV follow the language you pick. Section titles and labels printed in the CV ("Experience" / "Expériences professionnelles"…) come from translation files, in the **CV's own language**; your own renamed titles are kept.
- The **sample CV** exists in both languages.
- An **imported CV** is detected as French or English, the **other language is generated by the AI**, and both versions are saved in the same profile: switching the app language shows the matching version. If your CV is in the other language, the app switches to it.

### Import your existing CV
- Drop a **PDF** (with text), **DOCX** or **TXT** file, or paste the text.
- The text is extracted **in your browser**; it is only sent to the AI provider you selected, which structures it. The result is validated (Zod) and shown on a **review screen** before it replaces the sample data. You can cancel at any time, and a replacement can be undone with <kbd>Ctrl</kbd>+<kbd>Z</kbd>.
- Scanned PDFs (images) have no text: export them to DOCX, or paste the text.

### Cover letter
- Generated from the job offer and your CV, then **edited directly on its page**: recipient, date, subject, paragraphs (add / remove), sign-off.
- **Classic** or **Modern** template, your **signature** image, and the colors and font of your CV. Download as PDF.

### ATS checker
- A score from 0 to 100 with sub-scores (keywords, skills, experience, formatting), the **keywords found and missing** from the job posting, a **concrete action plan**, and a one-click adaptation to close the gaps.

### Export
- **PDF**: vector PDF rendered on the server, identical to the canvas.
- **DOCX**: single column, formatting kept, editable in Word.
- **TXT**: plain text, handy for application forms and ATS portals.

### Profiles
- Keep several CVs (each in French and English), each with its own cover letter and one adapted version per job offer, saved automatically in PostgreSQL.

### Guided tour and updates
- A **guided tour** introduces the whole app on the first visit; replay it anytime with the **?** button in the header.
- Self-hosted instances show an **"Update available"** badge with the release notes and the command to run (see [Updating](#updating)). After an update, a short **"What's new"** tour shows only the new features.
- **Light and dark** themes; menus, dialogs and scrollbars follow the app theme, and every menu closes when you click elsewhere or press <kbd>Esc</kbd>.

---

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/editor-dark.webp" alt="Editor, dark theme"><br><sub><b>Editor</b>, dark theme</sub></td>
    <td width="50%"><img src="docs/screenshots/ats-checker.png" alt="ATS checker"><br><sub><b>ATS checker</b>: audit a CV against a job posting</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/import-dialog.png" alt="Import my CV dialog"><br><sub><b>Import</b> a PDF, DOCX, TXT or pasted text</sub></td>
    <td width="50%"><img src="docs/screenshots/templates.png" alt="Template picker" width="260"><br><sub><b>Templates</b></sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/export-menu.png" alt="Export menu" width="400"><br><sub><b>Export</b> to PDF, DOCX or TXT</sub></td>
    <td></td>
  </tr>
</table>

All screenshots use the built-in fictional sample data.

<!-- Screenshots to refresh for v0.2.0 (same file names, plus new ones):
     editor-light.webp / editor-dark.webp : AI chat panel on the left + canvas toolbar with "Sections"
     cover-letter.png  : the cover letter editor (Editor tab)
     guided-tour.png   : one step of the guided tour
     update-badge.png  : the "Update available" panel in the header -->

---

## AI providers (bring your own key)

Kompyle has **no AI account and no hidden quota**: you bring a key for the provider you prefer and enter it in the **API Keys** dialog of the app.

| Provider | Free tier | Get an API key |
| --- | --- | --- |
| Google Gemini | Yes (Flash / Flash-Lite models) | https://aistudio.google.com/apikey |
| Groq | Yes (rate-limited) | https://console.groq.com/keys |
| OpenRouter | Yes (`:free` models, daily limit) | https://openrouter.ai/keys |
| NVIDIA NIM | Yes (prototyping use) | https://build.nvidia.com/settings/api-keys |
| Anthropic Claude | No | https://platform.claude.com/settings/keys |
| OpenAI | No | https://platform.openai.com/api-keys |

Free tiers have rate and daily limits. When one is reached, Kompyle shows a clear message: wait for the reset or switch to another provider. Free models are tried in order within the same provider.

---

## Privacy

- **Your CV text is only sent to the AI provider you choose**, when you click an AI action (adapt, refine, import, cover letter, ATS check). Kompyle never sends it to another provider on its own, and there is no analytics or tracking.
- **File extraction is local**: PDF, DOCX and TXT files are read in your browser and are never uploaded as files.
- **API keys stay in your browser** (`localStorage`). They travel only in the request to Kompyle's own API routes, which forward them to the provider's official endpoint, and are never stored server-side.
- **Profiles are stored in your own PostgreSQL**: the one running next to the app in Docker, or yours.
- **Update check**: the server downloads the public `release.json` from GitHub at most every 6 hours to know whether a newer version exists. Nothing about you or your CV is sent; disable it with `KOMPYLE_UPDATE_CHECK=false`.

To report a vulnerability, see [`SECURITY.md`](SECURITY.md).

---

## Local development

**Requirements:** [Node.js 22](https://nodejs.org/) (see `.nvmrc`) and npm. Docker is optional and only used for the database.

```bash
git clone https://github.com/omarouertani/Kompyle.git
cd Kompyle
npm install

docker compose up -d db     # optional: PostgreSQL on localhost:5432 (schema created automatically)
npm run db:seed             # optional: load the fictional "Jane Doe" profile
npm run dev                 # http://localhost:3000
```

Without PostgreSQL the app still starts: only saving profiles is unavailable.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Start / stop the PostgreSQL container (`docker compose up -d db`) |
| `npm run db:seed` | Insert the fictional sample profile ([`scripts/seed_profiles.sql`](scripts/seed_profiles.sql)) |
| `npm run release:check` | Validate [`release.json`](release.json) (versions, FR/EN texts, tour targets) before publishing |

Type-check with `npx tsc --noEmit`.

---

## Configuration

Everything has a working default: **no variable is required**. To change a value, copy the template and edit it:

```bash
cp .env.example .env
```

Docker Compose reads `.env` automatically; for `npm run dev`, use `.env.local` instead. See [`.env.example`](.env.example) for the full list.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | set by Docker Compose | PostgreSQL connection string (local development only) |
| `POSTGRES_PASSWORD` | `kompyle_dev` | Database password used by Docker Compose |
| `APP_PORT` / `DB_PORT` | `3000` / `5432` | Ports published on your machine |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public URL, for link-preview images |
| `OPENROUTER_API_KEY` | none | Optional server-side fallback key for OpenRouter |
| `KOMPYLE_UPDATE_CHECK` | `true` | Set to `false` to disable the “new version available” check |
| `KOMPYLE_UPDATE_URL` | `release.json` on GitHub `main` | Manifest used for the update check (fork or internal mirror) |

There is no variable for the other AI providers: their keys are entered in the app.

---

## Architecture

```
src/
├─ app/
│  ├─ [locale]/            Pages (English / French) — the workspace
│  └─ api/                 Route handlers: adapt-cv, refine-cv, import-cv, translate-cv,
│                          ats-check, generate-cover-letter, refine-cover-letter,
│                          cv-profiles, render-pdf, render-docx, update-check
├─ components/
│  ├─ cv/                  Canvas editor, templates (PDF), import, ATS, cover letter editor
│  ├─ ai-elements/         Chat building blocks of the AI panel (conversation, message, suggestion)
│  ├─ ai/                  Model picker
│  ├─ OnboardingTour.tsx   Guided tour and "What's new" tour (Driver.js)
│  ├─ UpdateNotice.tsx     "Update available" badge
│  └─ ui/                  shadcn/ui primitives
├─ lib/                    Layout engine, AI providers and orchestration, CV import,
│                          CV language (cv-i18n), experience-years guard, releases,
│                          skill levels, DOCX export, database access
├─ schemas/                Zod schemas for CV, cover letter and ATS results
└─ hooks/                  Profile manager, AI submission, outside-click dismiss
messages/                  en.json / fr.json (UI, CV labels, guided tour)
scripts/                   init.sql (schema), seed_profiles.sql, seed.ts, check-release.mjs
release.json               Versions, release notes and features shown in the tours
```

The CV data and its layout are stored separately (JSON in PostgreSQL), so the same content can be laid out on any template. The PDF is rendered server-side with `@react-pdf/renderer` from the same layout the canvas shows.

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org/) (App Router) and [React 19](https://react.dev/) |
| Language | TypeScript |
| UI | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), Radix UI and Base UI |
| Editor | [Tiptap](https://tiptap.dev/), [dnd-kit](https://dndkit.com/) |
| Guided tour | [Driver.js](https://driverjs.com/) |
| Export | [`@react-pdf/renderer`](https://react-pdf.org/) (PDF), [`docx`](https://docx.js.org/) (Word) |
| Import | [`unpdf`](https://github.com/unjs/unpdf) (PDF text), DOCX and TXT extraction in the browser |
| i18n | [`next-intl`](https://next-intl.dev/) |
| Database | [PostgreSQL](https://www.postgresql.org/) via `pg` |
| Validation | [Zod](https://zod.dev/) |

---

## Troubleshooting

- **The app starts but profiles cannot be saved** (a "Save failed" notice): PostgreSQL is not reachable. With Docker, check `docker compose ps` and `docker compose logs db`; in local development, start it with `docker compose up -d db`.
- **Port already in use**: `APP_PORT=3100 DB_PORT=5433 docker compose up --build`.
- **Start over with an empty database**: `docker compose down -v`, then `docker compose up --build`.
- **The schema changed after an update** (existing volume): the schema script only runs on an empty database; re-run it with `docker compose exec -T db psql -U kompyle -d kompyle < scripts/init.sql` (it is idempotent).

---

## Contributing

Contributions are welcome: bug reports, ideas and pull requests. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) first; every change also updates [`release.json`](release.json) (see [Releasing a Version](CONTRIBUTING.md#releasing-a-version)). AI coding agents follow the rules in [`AGENTS.md`](AGENTS.md).

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Omar Ouertani.
