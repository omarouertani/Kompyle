<div align="center">
  <img src="public/logo.svg" alt="Kompyle" height="56">
  <p><b>A production-grade, open-source AI resume editor and ATS auditor with a Canva-style workspace and total data privacy.</b></p>

  <p>
    <a href="#key-features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#local-development">Development</a> •
    <a href="#security--privacy">Security & Privacy</a> •
    <a href="#contributing">Contributing</a> •
    <a href="#license">License</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16.2.7-black?style=flat-square&logo=next.js" alt="Next.js Version">
    <img src="https://img.shields.io/badge/React-19.2.4-blue?style=flat-square&logo=react" alt="React Version">
    <img src="https://img.shields.io/badge/Tailwind-v4.0-38bdf8?style=flat-square&logo=tailwind-css" alt="Tailwind CSS">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
  </p>
</div>

---

**Kompyle** is a privacy-first, developer-centric web application designed to help you adapt, design, and audit resumes for modern job applications. By decoupling resume data structures from visual layout constraints, Kompyle gives you absolute freedom to position elements on a canvas, refine content using custom AI instructions, verify ATS readiness, and generate high-fidelity, pixel-perfect PDF exports.

---

## Workspace Showcase

![Kompyle Workspace Demo](public/images/workspace_demo.png)

![ATS Checker Preview](public/images/ats_preview.png)

---

## Key Features

- **Canva-Style Interactive Canvas**: Design layout constraints freely with absolute positioning, multi-select lassoing, magnetic snapping guides, floating alignment tools, workspace zooming, and space-pan navigation. Every pixel on the canvas translates 1:1 into a vector PDF generated server-side via `@react-pdf/renderer`.
- **Integrated ATS Auditor**: Audit how well your resume matches target descriptions. Get automated scores (0–100), formatting readability diagnostics, and a structured keyword reconciliation checklist. The auditor uses a self-healing LLM flow that auto-corrects structural validation issues dynamically.
- **Privacy-First AI Engine**: Leverage advanced LLMs (Gemini, Claude, OpenAI, Groq, Mistral, OpenRouter) with built-in anti-hallucination guardrails that lock and enforce the immutability of vital personal data (such as emails, phone numbers, dates, and locations).
- **Bilingual UI**: Full English and French localization out of the box via `next-intl`.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/) |
| PDF Engine | [`@react-pdf/renderer`](https://react-pdf.org/) (server-side vector PDF) |
| Canvas / DnD | [`dnd-kit`](https://dndkit.com/) |
| Internationalization | [`next-intl`](https://next-intl.dev/) (English / French) |
| Database | [PostgreSQL](https://www.postgresql.org/) (via `pg`) |
| Validation | [Zod](https://zod.dev/) |
| AI | BYOK multi-provider (Gemini, Claude, OpenAI, Groq, Mistral, OpenRouter) |

---

## Prerequisites

- **Node.js 20+** and **npm**
- **Docker** & **Docker Compose** (for the database, or to run the full stack in containers)
- At least one **AI provider API key** ([see below](#getting-ai-api-keys)) — entered directly in the web UI, no `.env` required

---

## Quick Start

You can run Kompyle instantly using Docker. **No environment variables are required in your terminal**, as all AI API keys are managed securely and directly inside the web UI.

### Option A: Docker Compose (Recommended)

Spin up both the Next.js app and the PostgreSQL database container together. The app image is built locally from the included `Dockerfile`:

```bash
docker compose up -d --build
```

### Option B: Separate Manual Containers

If you prefer to start separate containers manually without Docker Compose:

1. **Build the app image locally**:
   ```bash
   docker build -t kompyle:latest .
   ```

2. **Create a shared network**:
   ```bash
   docker network create kompyle-net
   ```

3. **Run the Database Container**:
   You must mount [`scripts/init.sql`](scripts/init.sql) to set up the database schema on startup:
   ```bash
   docker run -d \
     --name kompyle-db \
     --network kompyle-net \
     -e POSTGRES_DB=kompyle \
     -e POSTGRES_USER=kompyle \
     -e POSTGRES_PASSWORD=kompyle_dev \
     -v ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql \
     postgres:16-alpine
   ```

4. **Run the App Container**:
   Pass the `DATABASE_URL` pointing to the database container name:
   ```bash
   docker run -d -p 3000:3000 \
     --name kompyle-app \
     --network kompyle-net \
     -e DATABASE_URL="postgresql://kompyle:kompyle_dev@kompyle-db:5432/kompyle" \
     kompyle:latest
   ```

> [!NOTE]
> **Database Schema & Table Creation**: The Next.js application does not run migrations or create tables automatically on startup. The schema must be initialized beforehand. If you connect the app container to a blank PostgreSQL database without mounting the `init.sql` script at database startup, you will need to execute the SQL commands inside [`scripts/init.sql`](scripts/init.sql) manually.

After launching, navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Local Development

Get the project running locally in a few commands:

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch PostgreSQL (Optional)
Kompyle persists profiles and CV versions to a PostgreSQL database. You can start the pre-configured Postgres container using Docker Compose:
```bash
npm run db:up
```
*Note: If a database is not active, the system automatically falls back to an in-memory session mode to permit standard document creation, editing, and PDF downloads.*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view your workspace.

### Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run start` | Run the production build |
| `npm run lint` | Lint the codebase with ESLint |
| `npm run db:up` | Start the PostgreSQL container |
| `npm run db:down` | Stop the PostgreSQL container |
| `npm run db:seed` | Seed the database with sample data |

---

## Getting AI API Keys

Kompyle uses a **Bring Your Own Key** model — you provide a key for at least one of the supported providers. Keys are entered directly in the web UI and stored only in your browser (see [Security & Privacy](#security--privacy)).

| Provider | Get an API key |
| --- | --- |
| Google Gemini | https://aistudio.google.com/apikey |
| Anthropic Claude | https://console.anthropic.com/settings/keys |
| OpenAI | https://platform.openai.com/api-keys |
| Groq | https://console.groq.com/keys |
| Mistral | https://console.mistral.ai/api-keys |
| OpenRouter | https://openrouter.ai/keys |

> [!TIP]
> **OpenRouter** can also be configured server-side via an `OPENROUTER_API_KEY` environment variable as a fallback. See [`.env.example`](.env.example) for all optional environment variables.

---

> [!IMPORTANT]
> ### Security & Privacy
>
> Kompyle enforces a strict **Bring Your Own Key (BYOK)** model to preserve data autonomy:
> - **Strictly Client-Side Storage**: Your API keys (Google Gemini, Anthropic Claude, OpenAI, Groq, Mistral, OpenRouter) are stored exclusively in your browser's local storage (`window.localStorage`).
> - **Zero Server Persistence**: Keys are never sent to or cached on any external database. They are only sent in transient request payloads to local API route proxies which route requests directly to official AI endpoints.

To report a security vulnerability, please see [`SECURITY.md`](SECURITY.md).

---

## Contributing

Contributions are welcome! Whether it's a bug report, a feature idea, or a pull request, please read [`CONTRIBUTING.md`](CONTRIBUTING.md) to get started.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for the full text.

Copyright (c) 2026 Omar Ouertani.
