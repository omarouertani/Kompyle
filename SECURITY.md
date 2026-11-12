# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Kompyle, please report it **privately**. Do **not** open a public GitHub issue.

Preferred method:

- Use GitHub's [**Report a vulnerability**](https://github.com/omarouertani/Kompyle/security/advisories/new) (Security → Advisories) to open a private security advisory.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof of concept
- Affected version, browser, or environment details where relevant

You can expect an initial response within a few days. Once the issue is confirmed and a fix is available, we will coordinate disclosure with you.

## Supported Versions

Kompyle is under active development. Security fixes are applied to the latest version on the `main` branch.

## Data Handling

Kompyle is designed so that your data stays under your control:

- **AI provider keys (BYOK).** Keys are stored only in the user's browser `localStorage` and are never persisted server-side. They are included in transient request payloads to Kompyle's own API routes, which forward them to the official endpoint of the provider the user selected. The only server-side key is the optional `OPENROUTER_API_KEY` fallback.
- **CV content.** The text of a CV is sent only to the AI provider the user chose, when the user triggers an AI action (adapt, refine, import, cover letter, ATS check). It is never sent to another provider automatically. Uploaded files (PDF, DOCX, TXT) are read in the browser and are not uploaded.
- **Profiles.** Saved profiles live in the PostgreSQL database of the deployment (in Docker, the `pgdata` volume).
- **No tracking.** Kompyle contains no analytics or third-party tracking.

## Hardening a deployment

The default Docker Compose setup is meant for local use. Before exposing Kompyle on a network:

- Set your own `POSTGRES_PASSWORD` (default: `kompyle_dev`) before the first start. PostgreSQL is published on `127.0.0.1` only; keep it that way.
- Kompyle has **no built-in authentication**: anyone who can reach the app can read and edit the saved profiles. Put it behind a reverse proxy with access control (or keep it on a private network) if it is not for your own use only.
- Serve it over HTTPS, since API keys travel in requests from the browser.

See the [README](README.md#privacy) for details.
