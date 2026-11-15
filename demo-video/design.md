# Design — Kompyle demo video

Source: Kompyle's own dark theme (`src/app/globals.css`), sober "Linear-style" direction.

## Acts

1. **Hook** (intro, 3 s): the problem, in two lines.
2. **Product** (app, ~55 s): paste offer → AI adapts → cover letter → ATS score → theme + export.
3. **Call to action** (outro, 4 s): free, open source, Docker, GitHub link.

## Colour

| Role | Value | App token |
| --- | --- | --- |
| Ground | `#262626` → `#1b1b1b` (diagonal) | `--background` / `--muted` (dark) |
| Ink | `#faf8f1` | `--card-foreground` (dark) |
| Soft ink | `#b7b5a6` | `--muted-foreground` (dark) |
| Accent | `#d87757` | `--primary` (dark) |
| Lines | `#3e3e38` | `--border` (dark) |

One accent: the terracotta goes on the second intro line, click ripples and the GitHub URL only.

## Type

- Display: Playfair Display Bold (the app's serif headings), 116 px intro / 150 px wordmark.
- Text: IBM Plex Sans (the app's body font), 40–52 px; subtitles 40 px (16:9), 38 px (1:1), 44 px (9:16).
- Command: Consolas.

## Ground

The editor canvas's own grid (48 px, ink at 3.5 %), plus a faint terracotta glow top-left.

## Rules turned off

- **Gradient and drop shadow** on the app card: asked for in the brief (gradient background, rounded corners, shadow).
