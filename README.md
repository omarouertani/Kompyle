<div align="center">
  <h1>Kompyle</h1>
  <p><b>A production-grade, open-source AI resume editor and ATS auditor with a Canva-style workspace and total data privacy.</b></p>

  <p>
    <a href="#key-features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#local-development">Development</a> •
    <a href="#security--privacy">Security & Privacy</a> •
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

- **Canva-Style Interactive Canvas**: Design layout constraints freely with absolute positioning, multi-select lassoing, magnetic snapping guides, floating alignment tools, workspace zooming, and space-pan navigation. Every pixel on the canvas translates $1:1$ into a vector PDF generated server-side via `@react-pdf/renderer`.
- **Integrated ATS Auditor**: Audit how well your resume matches target descriptions. Get automated scores ($0\text{--}100$), formatting readability diagnostics, and a structured keyword reconciliation checklist. The auditor utilizes a self-healing LLM flow that auto-corrects structural validation issues dynamically.
- **Privacy-First AI Engine**: Leverage advanced LLMs (Gemini, Claude, GPT, Llama, Mistral) with built-in anti-hallucination guardrails that lock and enforce the immutability of vital personal data (such as emails, phone numbers, dates, and locations). 

---

## Quick Start

You can run Kompyle instantly using Docker. **No environment variables are required in your terminal**, as all AI API keys are managed securely and directly inside the web UI.

### Option A: Docker Compose (Everything in One Command)
If you have cloned the repository, spin up both the Next.js app and the PostgreSQL database container together:

```bash
docker compose up -d --build
```

### Option B: Pre-built Docker Image (Standalone Fallback)
Run the application container by itself. It will automatically run in local, database-free fallback mode (resumes will not persist after container restarts, but editing and PDF rendering are fully functional):

```bash
docker run -d -p 3000:3000 your-dockerhub-username/kompyle:latest
```

### Option C: Separate Manual Database & App Containers
If you prefer to start separate containers manually without Docker Compose:

1. **Create a shared network**:
   ```bash
   docker network create kompyle-net
   ```

2. **Run the Database Container**:
   You must mount [scripts/init.sql](file:///c:/Users/oouer/Projects/Kompyle/scripts/init.sql) to set up the database schema on startup:
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

3. **Run the Standalone App Container**:
   Pass the `DATABASE_URL` pointing to the database container name:
   ```bash
   docker run -d -p 3000:3000 \
     --name kompyle-app \
     --network kompyle-net \
     -e DATABASE_URL="postgresql://kompyle:kompyle_dev@kompyle-db:5432/kompyle" \
     your-dockerhub-username/kompyle:latest
   ```

> [!NOTE]
> **Database Schema & Table Creation**: The Next.js application does not run migrations or create tables automatically on startup. The schema must be initialized beforehand. If you connect the app container to a blank PostgreSQL database without mounting the `init.sql` script at database startup, you will need to execute the SQL commands inside [scripts/init.sql](file:///c:/Users/oouer/Projects/Kompyle/scripts/init.sql) manually.

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

---

> [!IMPORTANT]
> ### Security & Privacy
> 
> Kompyle enforces a strict **Bring Your Own Key (BYOK)** model to preserve data autonomy:
> - **Strictly Client-Side Storage**: Your API keys (Google Gemini, Anthropic Claude, OpenAI, Groq, Mistral) are stored exclusively in your browser's local storage (`window.localStorage`).
> - **Zero Server Persistence**: Keys are never sent to or cached on any external database. They are only sent in transient request payloads to local API route proxies which route requests directly to official AI endpoints.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for the full text.

Copyright (c) 2026 Omar Ouertani.
