'use strict';
/**
 * Compositor: turns out/capture (screencast frames + timeline.json) into the
 * final videos. Runs in headless Chromium on a <canvas>: intro, app card with
 * eased camera zooms, drawn cursor + click ripples, subtitles, outro.
 * Frames are piped to ffmpeg (H.264), then music is mixed in and a
 * thumbnail is extracted.
 *
 *   node scripts/render.cjs                 all formats
 *   node scripts/render.cjs 16x9 --preview  one format, 2x faster draft
 */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { COLORS, SUBTITLES, INTRO, OUTRO, FORMATS } = require('./lib/story.cjs');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const CAP = path.join(ROOT, 'out', 'capture');
const OUT = path.join(ROOT, 'out', 'video');
const FPS = 30;
const WAIT_OUT = 1.3;          // an AI wait of any length lasts this long on screen
const TAIL = 0.5;              // seconds kept after the last scene mark

const args = process.argv.slice(2);
const PREVIEW = args.includes('--preview');
const THUMBS_ONLY = args.includes('--thumbs');
const ONLY = args.filter((a) => FORMATS[a]);
const formats = ONLY.length ? ONLY : Object.keys(FORMATS);

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ─── Timeline (output seconds ⇄ source seconds) ─────────────────────────────
function buildTimeline(tl) {
  const rel = (t) => t - tl.tStart;
  const marks = tl.marks.map((m) => ({ ...m, s: rel(m.t) }));
  const endMark = marks.filter((m) => m.name === 'scene' && m.scene === 'end').pop();
  const srcEnd = (endMark ? endMark.s : rel(tl.tEnd)) + TAIL;

  // Piecewise-linear map: AI waits are compressed to WAIT_OUT seconds.
  const pieces = [];
  let s = 0, u = 0;
  const waits = [];
  for (const m of marks) {
    if (m.name === 'wait-start') waits.push({ a: m.s });
    if (m.name === 'wait-end' && waits.length) waits[waits.length - 1].b = m.s;
  }
  for (const w of waits.filter((w) => w.b > w.a)) {
    pieces.push({ s0: s, s1: w.a, u0: u, u1: u + (w.a - s) }); u += w.a - s; s = w.a;
    const outDur = Math.min(WAIT_OUT, w.b - w.a);
    pieces.push({ s0: s, s1: w.b, u0: u, u1: u + outDur }); u += outDur; s = w.b;
  }
  pieces.push({ s0: s, s1: srcEnd, u0: u, u1: u + (srcEnd - s) }); u += srcEnd - s;
  const appDur = u;

  const toSrc = (x) => {
    const p = pieces.find((p) => x >= p.u0 && x <= p.u1) || pieces[pieces.length - 1];
    return p.s0 + ((x - p.u0) / (p.u1 - p.u0 || 1)) * (p.s1 - p.s0);
  };
  const toOut = (x) => {
    const p = pieces.find((p) => x >= p.s0 && x <= p.s1) || pieces[pieces.length - 1];
    return p.u0 + ((x - p.s0) / (p.s1 - p.s0 || 1)) * (p.u1 - p.u0);
  };

  const cams = marks.filter((m) => m.name === 'cam').map((m) => ({ u: toOut(m.s), cx: m.cx, cy: m.cy, h: m.h, ease: m.ease }));
  const scenes = marks.filter((m) => m.name === 'scene').map((m) => ({ u: toOut(m.s), scene: m.scene }));
  const keys = marks.filter((m) => m.name === 'key').map((m) => ({ u: toOut(m.s), label: m.label }));
  const clicks = tl.clicks.map((c) => ({ u: toOut(rel(c.t)), x: c.x, y: c.y }));
  const moves = tl.moves.map((m) => ({ s: rel(m.t), x: m.x, y: m.y }));
  const frames = tl.frames.map((f) => ({ s: rel(f.t), file: f.file }));
  return { appDur, toSrc, cams, scenes, keys, clicks, moves, frames };
}

function camAt(cams, u) {
  if (!cams.length) return { cx: 960, cy: 540, h: 1080 };
  let i = -1;
  for (let k = 0; k < cams.length; k++) if (cams[k].u <= u) i = k;
  if (i < 0) return cams[0];
  const cur = cams[i];
  const prev = i > 0 ? cams[i - 1] : cur;
  const k = cur.ease > 0 ? ease((u - cur.u) / cur.ease) : 1;
  return { cx: lerp(prev.cx, cur.cx, k), cy: lerp(prev.cy, cur.cy, k), h: lerp(prev.h, cur.h, k) };
}

function cursorAt(moves, s) {
  if (!moves.length || s < moves[0].s) return { x: 1250, y: 640 };
  let lo = 0, hi = moves.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (moves[mid].s <= s) lo = mid; else hi = mid - 1; }
  const a = moves[lo], b = moves[lo + 1];
  if (!b || b.s - a.s > 0.08) return { x: a.x, y: a.y };
  const k = (s - a.s) / (b.s - a.s);
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
}

function frameAt(frames, s) {
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (frames[mid].s <= s) lo = mid; else hi = mid - 1; }
  return frames[lo].file;
}

// ─── Per-frame states ────────────────────────────────────────────────────────
function* states(T, fmt) {
  const F = FORMATS[fmt];
  const aspect = F.card.w / F.card.h;
  const total = INTRO.seconds + T.appDur + OUTRO.seconds;
  const n = Math.round(total * FPS);
  let follow = null;
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    if (t < INTRO.seconds) { yield { mode: 'intro', t, total }; continue; }
    const u = t - INTRO.seconds;
    if (u >= T.appDur) { yield { mode: 'outro', t: u - T.appDur, total }; continue; }

    const s = T.toSrc(u);
    const cam = camAt(T.cams, u);
    const cur = cursorAt(T.moves, s);
    // Square / vertical formats drift towards the cursor so the action stays in frame.
    const target = { x: lerp(cam.cx, cur.x, F.follow), y: lerp(cam.cy, cur.y, F.follow * 0.6) };
    follow = follow ? { x: lerp(follow.x, target.x, 0.07), y: lerp(follow.y, target.y, 0.07) } : target;
    let hs = Math.min(1080, F.follow > 0 ? cam.h * 1.0 : cam.h);
    let ws = hs * aspect;
    if (ws > 1920) { ws = 1920; hs = ws / aspect; }
    const sx = clamp(follow.x - ws / 2, 0, 1920 - ws);
    const sy = clamp(follow.y - hs / 2, 0, 1080 - hs);

    let scene = null, sceneU = 0, nextU = Infinity;
    for (let k = 0; k < T.scenes.length; k++) if (T.scenes[k].u <= u) { scene = T.scenes[k].scene; sceneU = T.scenes[k].u; nextU = T.scenes[k + 1]?.u ?? Infinity; }
    const sub = SUBTITLES[scene] || '';
    const subAlpha = sub ? Math.min(ease((u - sceneU - 0.15) / 0.3), ease((nextU - u - 0.05) / 0.25), ease((T.appDur - u) / 0.3)) : 0;

    const ripples = T.clicks.filter((c) => u >= c.u && u - c.u < 0.55).map((c) => ({ x: c.x, y: c.y, k: (u - c.u) / 0.55 }));
    const press = T.clicks.some((c) => u >= c.u - 0.04 && u - c.u < 0.14);
    const key = T.keys.find((k) => u >= k.u && u - k.u < 1.3);
    yield {
      mode: 'app', t, u, total,
      frame: frameAt(T.frames, s),
      src: { x: sx, y: sy, w: ws, h: hs },
      cursor: cur, press, ripples,
      key: key ? { label: key.label, a: Math.min(ease((u - key.u) / 0.15), ease((key.u + 1.3 - u) / 0.2)) } : null,
      sub, subAlpha: Math.max(0, subAlpha),
      intro: ease(u / 0.45),
    };
  }
}

// ─── Browser-side drawing ────────────────────────────────────────────────────
function pageHtml() {
  return `<!doctype html><html><body style="margin:0;background:#000"><canvas id="c"></canvas></body></html>`;
}

async function setupPage(browser, fmt) {
  const F = FORMATS[fmt];
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const files = {
    'plex.woff2': path.join(REPO, 'node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2'),
    'playfair.ttf': path.join(REPO, 'public/fonts/playfairdisplay/PlayfairDisplay-Bold.ttf'),
  };
  await page.route('http://r/**', async (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
    if (name === 'index.html') return route.fulfill({ body: pageHtml(), contentType: 'text/html' });
    const file = files[name] || path.join(CAP, 'frames', name);
    await route.fulfill({ body: fs.readFileSync(file), contentType: name.endsWith('.jpg') ? 'image/jpeg' : 'font/woff2' });
  });
  await page.goto('http://r/index.html');
  await page.evaluate(async ({ F, C, INTRO, OUTRO }) => {
    const plex = new FontFace('Plex', 'url(http://r/plex.woff2)', { weight: '100 700' });
    const pf = new FontFace('Playfair', 'url(http://r/playfair.ttf)', { weight: '700' });
    await Promise.all([plex.load(), pf.load()]);
    document.fonts.add(plex); document.fonts.add(pf);
    const cv = document.getElementById('c'); cv.width = F.w; cv.height = F.h;
    const g = cv.getContext('2d');
    const E = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
    let cache = { name: null, bmp: null };

    function ground() {
      const gr = g.createLinearGradient(0, 0, F.w, F.h);
      gr.addColorStop(0, C.ground2); gr.addColorStop(1, C.ground);
      g.fillStyle = gr; g.fillRect(0, 0, F.w, F.h);
      const glow = g.createRadialGradient(F.w * 0.18, F.h * 0.08, 0, F.w * 0.18, F.h * 0.08, Math.max(F.w, F.h) * 0.7);
      glow.addColorStop(0, 'rgba(216,119,87,0.10)'); glow.addColorStop(1, 'rgba(216,119,87,0)');
      g.fillStyle = glow; g.fillRect(0, 0, F.w, F.h);
      // The editor's own canvas grid, as a faint ground.
      g.strokeStyle = 'rgba(250,248,241,0.035)'; g.lineWidth = 1;
      g.beginPath();
      for (let x = 0.5; x < F.w; x += 48) { g.moveTo(x, 0); g.lineTo(x, F.h); }
      for (let y = 0.5; y < F.h; y += 48) { g.moveTo(0, y); g.lineTo(F.w, y); }
      g.stroke();
    }
    function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
    function text(str, x, y, font, color, alpha = 1, align = 'center') {
      g.save(); g.globalAlpha = alpha; g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(str, x, y); g.restore();
    }
    function wrap(str, font, maxW) {
      g.font = font; const words = str.split(' '); const lines = []; let line = '';
      for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
      lines.push(line); return lines;
    }
    function cursor(x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s);
      g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
      const p = new Path2D('M0 0 L0 22 L5.6 16.8 L9.4 25.4 L13 23.8 L9.3 15.4 L16.6 15.4 Z');
      g.fillStyle = '#111'; g.fill(p); g.shadowColor = 'transparent';
      g.lineWidth = 1.6; g.strokeStyle = '#fff'; g.lineJoin = 'round'; g.stroke(p);
      g.restore();
    }

    window.draw = async (st) => {
      ground();
      if (st.mode === 'intro') {
        const t = st.t; const big = F.w < 1200 ? 88 : 116; const small = F.w < 1200 ? 44 : 52;
        const maxW = F.w - 140;
        const l1 = wrap(INTRO.line1, `700 ${big}px Playfair`, maxW);
        const l2 = wrap(INTRO.line2, `500 ${small}px Plex`, maxW);
        const blockH = l1.length * big * 1.08 + 40 + l2.length * small * 1.3;
        let y = F.h / 2 - blockH / 2 + big * 0.85;
        const a1 = E(t / 0.5), a2 = E((t - 1.25) / 0.5);
        for (const ln of l1) { text(ln, F.w / 2, y + (1 - a1) * 18, `700 ${big}px Playfair`, C.ink, a1); y += big * 1.08; }
        y += 40 - big * 0.08 + small * 0.2;
        for (const ln of l2) { text(ln, F.w / 2, y + (1 - a2) * 14, `500 ${small}px Plex`, C.accent, a2); y += small * 1.3; }
        return cv.toDataURL('image/jpeg', 0.95);
      }
      if (st.mode === 'outro') {
        const t = st.t; const vert = F.h > F.w;
        const wm = F.w < 1200 ? 120 : 150; const body = F.w < 1200 ? 40 : 44;
        let y = F.h / 2 - (vert ? 260 : 200);
        const a = (d) => E((t - d) / 0.45);
        text(OUTRO.wordmark, F.w / 2, y + (1 - a(0)) * 16, `700 ${wm}px Playfair`, C.ink, a(0));
        y += 110;
        // Points: "Free · Open source · Runs anywhere with Docker" (wrapped on narrow formats).
        const pts = OUTRO.points;
        const rows = F.w < 1200 ? [[pts[0], pts[1]], [pts[2]]] : [pts];
        rows.forEach((row, r) => {
          const str = row.join('   ·   ');
          text(str, F.w / 2, y + r * body * 1.45 + (1 - a(0.25 + r * 0.12)) * 12, `500 ${body}px Plex`, C.inkSoft, a(0.25 + r * 0.12));
        });
        y += rows.length * body * 1.45 + 50;
        // Command pill.
        g.save(); g.globalAlpha = a(0.55);
        g.font = `500 ${body - 4}px Consolas, "Cascadia Code", monospace`;
        const cmd = '$ ' + OUTRO.command; const cw = g.measureText(cmd).width + 64; const ch = body + 34;
        rr(F.w / 2 - cw / 2, y - ch / 2 - body * 0.35, cw, ch, 14); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill(); g.strokeStyle = C.border; g.lineWidth = 2; g.stroke();
        g.fillStyle = C.ink; g.textAlign = 'center'; g.fillText(cmd, F.w / 2, y - body * 0.35 + body * 0.36);
        g.restore();
        y += ch + 50;
        text(OUTRO.url, F.w / 2, y + (1 - a(0.8)) * 12, `600 ${body}px Plex`, C.accent, a(0.8));
        // Accent rule under the URL.
        g.save(); g.globalAlpha = a(0.8); g.font = `600 ${body}px Plex`; const uw = g.measureText(OUTRO.url).width;
        g.fillStyle = C.accent; g.fillRect(F.w / 2 - uw / 2, y + 16, uw * E((t - 0.9) / 0.6), 3); g.restore();
        return cv.toDataURL('image/jpeg', 0.95);
      }

      // App card
      if (cache.name !== st.frame) {
        const res = await fetch('http://r/' + st.frame); const blob = await res.blob();
        if (cache.bmp) cache.bmp.close();
        cache = { name: st.frame, bmp: await createImageBitmap(blob) };
      }
      const k = st.intro; const sc = 0.965 + 0.035 * k;
      const c = F.card;
      const cw = c.w * sc, ch = c.h * sc, cx = c.x + (c.w - cw) / 2, cy = c.y + (c.h - ch) / 2 + (1 - k) * 16;
      g.save(); g.globalAlpha = k;
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 70; g.shadowOffsetY = 24;
      rr(cx, cy, cw, ch, 18); g.fillStyle = C.ground2; g.fill();
      g.shadowColor = 'transparent';
      g.save(); rr(cx, cy, cw, ch, 18); g.clip();
      const bmp = cache.bmp; const ratio = bmp.width / 1920;
      g.imageSmoothingQuality = 'high';
      g.drawImage(bmp, st.src.x * ratio, st.src.y * ratio, st.src.w * ratio, st.src.h * ratio, cx, cy, cw, ch);
      const map = (x, y) => [cx + ((x - st.src.x) / st.src.w) * cw, cy + ((y - st.src.y) / st.src.h) * ch];
      for (const r of st.ripples) {
        const [rx, ry] = map(r.x, r.y);
        g.beginPath(); g.arc(rx, ry, 10 + 34 * E(r.k), 0, Math.PI * 2);
        g.strokeStyle = `rgba(216,119,87,${0.85 * (1 - r.k)})`; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.arc(rx, ry, 12, 0, Math.PI * 2); g.fillStyle = `rgba(216,119,87,${0.25 * (1 - r.k)})`; g.fill();
      }
      const [mx, my] = map(st.cursor.x, st.cursor.y);
      cursor(mx, my, (F.w < 1200 ? 1.35 : 1.5) * (st.press ? 0.86 : 1));
      if (st.key) {
        g.save(); g.globalAlpha = st.key.a; g.font = '600 28px Plex';
        const kw = g.measureText(st.key.label).width + 36;
        rr(mx + 30, my + 34, kw, 50, 12); g.fillStyle = C.ink; g.fill();
        g.fillStyle = C.ground; g.textAlign = 'left'; g.fillText(st.key.label, mx + 48, my + 69);
        g.restore();
      }
      g.restore();
      g.lineWidth = 1.5; g.strokeStyle = 'rgba(250,248,241,0.10)'; rr(cx, cy, cw, ch, 18); g.stroke();
      g.restore();

      if (F.h > F.w) text('Kompyle', F.w / 2, 190, '700 72px Playfair', C.ink, 1);
      if (st.sub && st.subAlpha > 0) {
        const font = `500 ${F.sub}px Plex`;
        const lines = wrap(st.sub, font, F.w - 160);
        const lh = F.sub * 1.3;
        g.save(); g.globalAlpha = st.subAlpha; g.font = font;
        const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 56;
        const h = lines.length * lh + 26;
        const top = F.subY - h / 2;
        rr(F.w / 2 - w / 2, top, w, h, h / 2 > 40 ? 22 : h / 2); g.fillStyle = 'rgba(14,14,14,0.72)'; g.fill();
        g.strokeStyle = C.border; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = C.ink; g.textAlign = 'center';
        lines.forEach((l, i) => g.fillText(l, F.w / 2, top + 13 + lh * (i + 0.78)));
        g.restore();
      }
      return cv.toDataURL('image/jpeg', 0.95);
    };
  }, { F, C: COLORS, INTRO, OUTRO });
  return page;
}

async function renderFormat(browser, T, fmt) {
  const F = FORMATS[fmt];
  fs.mkdirSync(OUT, { recursive: true });
  const silent = path.join(OUT, `kompyle-demo-${fmt}.silent.mp4`);
  const page = await setupPage(browser, fmt);
  const step = PREVIEW ? 2 : 1;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS / step), '-i', '-',
    '-c:v', 'libx264', '-preset', PREVIEW ? 'veryfast' : 'slow', '-crf', PREVIEW ? '24' : '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  let i = 0; const t0 = Date.now();
  for (const st of states(T, fmt)) {
    if (i++ % step) continue;
    const url = await page.evaluate((s) => window.draw(s), st);
    const ok = ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    if (!ok) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 300 === 0) process.stdout.write(`  ${fmt}: ${(i / FPS).toFixed(0)}s rendered (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await page.close();
  return silent;
}

function finish(silent, fmt, total) {
  const final = path.join(OUT, `kompyle-demo-${fmt}.mp4`);
  const music = path.join(ROOT, 'assets', 'music.mp3');
  const fade = Math.max(0, total - 2.5).toFixed(2);
  if (fs.existsSync(music)) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-stream_loop', '-1', '-i', music,
      '-filter_complex', `[1:a]atrim=0:${total.toFixed(2)},volume=0.35,afade=t=in:d=1.2,afade=t=out:st=${fade}:d=2.5,aformat=sample_rates=48000:channel_layouts=stereo[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
  } else {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', final]);
  }
  fs.rmSync(silent);
  return final;
}

(async () => {
  const tl = JSON.parse(fs.readFileSync(path.join(CAP, 'timeline.json'), 'utf8'));
  const T = buildTimeline(tl);
  const total = INTRO.seconds + T.appDur + OUTRO.seconds;
  console.log(`app ${T.appDur.toFixed(1)}s, total ${total.toFixed(1)}s, formats: ${formats.join(', ')}${PREVIEW ? ' (preview)' : ''}`);
  const browser = await chromium.launch();
  for (const fmt of formats) {
    const final = THUMBS_ONLY ? path.join(OUT, `kompyle-demo-${fmt}.mp4`) : finish(await renderFormat(browser, T, fmt), fmt, total);
    // Thumbnail: the ATS score screen (first close-up of the "ats" scene, once settled).
    const i = T.scenes.findIndex((x) => x.scene === 'ats');
    const close = i >= 0 ? T.cams.find((c) => c.u > T.scenes[i].u && c.u < (T.scenes[i + 1]?.u ?? Infinity) && c.h <= 680) : null;
    const thumbAt = close ? INTRO.seconds + close.u + close.ease + 0.6 : total / 2;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', thumbAt.toFixed(2), '-i', final, '-frames:v', '1', path.join(OUT, `kompyle-demo-${fmt}.png`)]);
    console.log('wrote', path.relative(ROOT, final));
  }
  await browser.close();
})();
