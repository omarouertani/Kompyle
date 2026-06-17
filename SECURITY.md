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

## Data Handling Note

Kompyle uses a **Bring Your Own Key (BYOK)** model. AI provider API keys are stored exclusively in the user's browser `localStorage` and are never persisted server-side. Keys are only included in transient request payloads to local API route proxies, which forward them directly to the official AI provider endpoints. See the [README](README.md#security--privacy) for details.
