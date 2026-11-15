# Demo video and README screenshots

Scripts that regenerate the README screenshots (`docs/screenshots/`) and the
~1 minute demo video of Kompyle (16:9, 1:1 and 9:16), so both can be refreshed
after the UI changes.

Everything runs against an **isolated Kompyle instance** with its own empty
database (only the fictional *Jane Doe* sample), never against your real
profiles.

## Requirements

- Docker (the `kompyle:latest` image, built by `docker compose up --build` at the repo root)
- Node.js 20+ and ffmpeg on the `PATH`

```bash
cd demo-video
npm install
npx playwright install chromium
```

## Refresh

```bash
# 1. Start the isolated instance (http://localhost:3100), on a fresh database
docker compose -f docker-compose.demo.yml down -v
docker compose -f docker-compose.demo.yml up -d

# 2. README screenshots → ../docs/screenshots/
npm run screenshots

# 3. Demo video: record the app, then compose the three formats
npm run record          # → out/capture/ (frames + timeline.json)
npm run build           # → out/video/kompyle-demo-{16x9,1x1,9x16}.mp4 + .png thumbnails
```

Rebuild the image first (`docker compose up -d --build` at the repo root) if the
app changed. `node scripts/render.cjs 16x9 --preview` renders one format at
half the frame rate, for a quick check, and `scripts/contact-sheet.sh <video>`
tiles frames into a contact sheet.

## How it works

| File | Role |
| --- | --- |
| `docker-compose.demo.yml` | Isolated app + database (port 3100) |
| `data/job-offer.txt` | The fictional job offer pasted in the demo |
| `scripts/lib/app.cjs` | Browser context: tour dismissed, AI model chosen, dark/light theme |
| `scripts/lib/ai-mock.cjs` | Scripted AI answers (see below) |
| `scripts/lib/capture.cjs` | CDP screencast + eased mouse moves, clicks and marks log |
| `scripts/record.cjs` | The demo itself: scenes, clicks, camera keyframes, AI waits |
| `scripts/lib/story.cjs` | Subtitles, intro/outro text, colours, output formats |
| `scripts/render.cjs` | Compositor (canvas in headless Chromium → ffmpeg) |
| `scripts/thumbs.cjs` | Thumbnails for the square and vertical videos |
| `scripts/screenshots.cjs` | README screenshots |
| `design.md` | Visual decisions for the video |

- **Recording.** `record.cjs` drives the real app at 1920×1080 with
  `deviceScaleFactor: 2` and saves every screencast frame (4K JPEG) with its
  timestamp. The cursor is *not* drawn in the page: its positions are logged
  and the compositor draws it at 30 fps, so it stays smooth even though the
  screencast only sends a frame when the page changes (~19 fps on average).
- **Editing.** `render.cjs` maps output time to source time (each AI wait is
  shortened to 1.3 s), interpolates the camera keyframes with an ease-in-out,
  draws the app on a rounded card over the app's dark background and grid,
  adds click ripples, a <kbd>Ctrl + V</kbd> key hint and the subtitles, then
  the intro and outro. Square and vertical formats follow the cursor so the
  action stays in frame.
- **Exports.** H.264 (CRF 17) + AAC 192 kb/s, `+faststart`, 30 fps; a PNG
  thumbnail per format: the ATS score frame for 16:9, a headline + that frame
  for 1:1 and 9:16 (`scripts/thumbs.cjs`).

## AI answers in the recording

`DEMO_AI` defaults to `mock`: Playwright intercepts `/api/adapt-cv`,
`/api/ats-check` and `/api/generate-cover-letter` and answers with content
written in `lib/ai-mock.cjs`, in exactly the shape the real routes return and
following their rules (name, contacts, education, job titles, companies and
dates unchanged). This keeps the recording independent of free models being
up and keeps API keys off screen. Everything else on screen is the real app.

To record with the real AI instead, put a valid key in `../.env.local`
(`OPENROUTER_API_KEY=…`) and run `DEMO_AI=live npm run record`. The key is
injected into the browser's storage, and the API Keys dialog is never opened
on camera.

## Music

`assets/music.mp3` (ignored by git) is mixed in at low volume with fades. The
current track was generated for this video with ElevenLabs Music v2.5 through
Higgsfield (instrumental, 62 s). Replace it with any royalty-free track; if the
file is missing, the video gets a silent audio track.
