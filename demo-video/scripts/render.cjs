'use strict';
/**
 * Compositor: turns out/capture (screencast frames + timeline.json) into the
 * final videos. Runs in headless Chromium on a <canvas>: intro, chapter cards,
 * app card with eased camera zooms, drawn cursor + click ripples, subtitles,
 * outro. Block changes use gl-transitions shaders (WebGL, MIT licence).
 * Frames are piped to ffmpeg (H.264), then music + transition whooshes are
 * mixed in and a thumbnail is extracted.
 *
 *   node scripts/render.cjs                 all formats
 *   node scripts/render.cjs 16x9 --preview  one format, 2x faster draft
 *   node scripts/render.cjs --thumbs        thumbnails only (videos already rendered)
 */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const GL_TRANSITIONS = require('gl-transitions');
const { COLORS, SUBTITLES, CARDS, CARD_SECONDS, BADGE, INTRO, OUTRO, TRANSITIONS, FORMATS } = require('./lib/story.cjs');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const CAP = path.join(ROOT, 'out', 'capture');
const OUT = path.join(ROOT, 'out', 'video');
const FPS = 30;
const WAIT_OUT = 1.3;          // an AI wait of any length lasts this long on screen
const FF = 3;                  // speed-up of ff-start/ff-end stretches
const TAIL = 0.5;             // seconds kept after the last scene mark
const TR = TRANSITIONS.seconds;

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
  const W = tl.width || 1920, H = tl.height || 1080;
  const rel = (t) => t - tl.tStart;
  const marks = tl.marks.map((m) => ({ ...m, s: rel(m.t) }));
  const endMark = marks.filter((m) => m.name === 'scene' && m.scene === 'end').pop();
  const srcEnd = (endMark ? endMark.s : rel(tl.tEnd)) + TAIL;

  // Piecewise-linear map: AI waits are compressed to WAIT_OUT seconds.
  const pieces = [];
  let s = 0, u = 0;
  const waits = [];
  // wait-start/end: AI wait, shown for WAIT_OUT s. ff-start/end: dull stretch (typing), played FF times faster.
  for (const m of marks) {
    if (m.name === 'wait-start' || m.name === 'ff-start') waits.push({ a: m.s, ff: m.name === 'ff-start' });
    if ((m.name === 'wait-end' || m.name === 'ff-end') && waits.length) waits[waits.length - 1].b = m.s;
  }
  for (const w of waits.filter((w) => w.b > w.a)) {
    pieces.push({ s0: s, s1: w.a, u0: u, u1: u + (w.a - s) }); u += w.a - s; s = w.a;
    const outDur = w.ff ? (w.b - w.a) / FF : Math.min(WAIT_OUT, w.b - w.a);
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

  // Blocks of the edit: intro, then per scene an optional chapter card and the app, then the outro.
  const blocks = [{ type: 'intro', dur: INTRO.seconds }];
  scenes.forEach((sc, i) => {
    if (sc.scene === 'end') return;
    const u1 = scenes[i + 1] ? scenes[i + 1].u : appDur;
    if (CARDS[sc.scene]) blocks.push({ type: 'card', id: sc.scene, dur: CARDS[sc.scene].seconds || CARD_SECONDS });
    blocks.push({ type: 'app', scene: sc.scene, u0: sc.u, u1, dur: u1 - sc.u });
  });
  const lastScene = scenes.filter((x) => x.scene !== 'end').pop();
  const app = blocks.filter((b) => b.type === 'app').pop();
  if (app && lastScene) { app.u1 = appDur; app.dur = appDur - app.u0; }
  blocks.push({ type: 'outro', dur: OUTRO.seconds });
  let t = 0;
  for (const b of blocks) { b.t0 = t; t += b.dur; }
  const total = t;
  const uToT = (x) => { const b = blocks.find((b) => b.type === 'app' && x >= b.u0 && x < b.u1); return b ? b.t0 + (x - b.u0) : null; };
  // Transition at the start of every block whose kind differs from the previous one's.
  const transitions = blocks.slice(1).map((b, i) => (b.type !== blocks[i].type ? b.t0 : null)).filter((x) => x !== null);
  return { W, H, appDur, toSrc, cams, scenes, keys, clicks, moves, frames, blocks, total, uToT, transitions };
}

function camAt(cams, u) {
  if (!cams.length) return null;
  let i = -1;
  for (let k = 0; k < cams.length; k++) if (cams[k].u <= u) i = k;
  if (i < 0) return cams[0];
  const cur = cams[i];
  const prev = i > 0 ? cams[i - 1] : cur;
  const k = cur.ease > 0 ? ease((u - cur.u) / cur.ease) : 1;
  return { cx: lerp(prev.cx, cur.cx, k), cy: lerp(prev.cy, cur.cy, k), h: lerp(prev.h, cur.h, k) };
}

function cursorAt(moves, s) {
  if (!moves.length) return { x: 0, y: 0 };
  if (s < moves[0].s) return { x: moves[0].x, y: moves[0].y };
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
  const n = Math.round(T.total * FPS);
  let follow = null;
  let bi = 0;
  let last = null, prevLast = null;

  function appState(b, local) {
    const u = Math.min(b.u0 + local, b.u1 - 1e-3);
    const s = T.toSrc(u);
    const cam = camAt(T.cams, u) || { cx: T.W / 2, cy: T.H / 2, h: T.H };
    const cur = cursorAt(T.moves, s);
    // Square / vertical formats drift towards the cursor so the action stays in frame.
    const target = { x: lerp(cam.cx, cur.x, F.follow), y: lerp(cam.cy, cur.y, F.follow * 0.6) };
    follow = follow && local > 0 ? { x: lerp(follow.x, target.x, 0.07), y: lerp(follow.y, target.y, 0.07) } : target;
    let hs = Math.min(T.H, cam.h);
    let ws = hs * aspect;
    if (ws > T.W) { ws = T.W; hs = ws / aspect; }
    const sx = clamp(follow.x - ws / 2, 0, T.W - ws);
    const sy = clamp(follow.y - hs / 2, 0, T.H - hs);

    const sub = SUBTITLES[b.scene] || '';
    const subAlpha = sub ? Math.min(ease((local - 0.25) / 0.3), ease((b.dur - local - 0.05) / 0.25)) : 0;
    const ripples = T.clicks.filter((c) => u >= c.u && u - c.u < 0.55).map((c) => ({ x: c.x, y: c.y, k: (u - c.u) / 0.55 }));
    const press = T.clicks.some((c) => u >= c.u - 0.04 && u - c.u < 0.14);
    const key = T.keys.find((k) => u >= k.u && u - k.u < 1.3);
    return {
      mode: 'app', W: T.W,
      frame: frameAt(T.frames, s),
      src: { x: sx, y: sy, w: ws, h: hs },
      cursor: cur, press, ripples,
      key: key ? { label: key.label, a: Math.min(ease((u - key.u) / 0.15), ease((key.u + 1.3 - u) / 0.2)) } : null,
      sub, subAlpha: Math.max(0, subAlpha),
    };
  }

  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    while (bi < T.blocks.length - 1 && t >= T.blocks[bi + 1].t0) { bi++; prevLast = last; }
    const b = T.blocks[bi];
    const local = t - b.t0;
    let st;
    if (b.type === 'intro') st = { mode: 'intro', t: local };
    else if (b.type === 'outro') st = { mode: 'outro', t: local };
    else if (b.type === 'card') st = { mode: 'card', t: local, card: CARDS[b.id], index: Object.keys(CARDS).indexOf(b.id), count: Object.keys(CARDS).length };
    else st = appState(b, local);
    last = st;
    const prev = T.blocks[bi - 1];
    if (prev && prev.type !== b.type && local < TR && prevLast) {
      const tr = b.type === 'app' ? TRANSITIONS.toApp : TRANSITIONS.toCard;
      yield { mode: 'trans', a: prevLast, b: st, p: ease(local / TR), tr: tr.name };
    } else yield st;
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
  const used = [TRANSITIONS.toCard, TRANSITIONS.toApp].map((x) => {
    const def = GL_TRANSITIONS.find((g) => g.name === x.name);
    if (!def) throw new Error('unknown gl-transition ' + x.name);
    return { name: x.name, glsl: def.glsl, params: { ...def.defaultParams, ...x.params } };
  });
  await page.evaluate(async ({ F, C, INTRO, OUTRO, BADGE, GLT }) => {
    const plex = new FontFace('Plex', 'url(http://r/plex.woff2)', { weight: '100 700' });
    const pf = new FontFace('Playfair', 'url(http://r/playfair.ttf)', { weight: '700' });
    await Promise.all([plex.load(), pf.load()]);
    document.fonts.add(plex); document.fonts.add(pf);
    const cv = document.getElementById('c'); cv.width = F.w; cv.height = F.h;
    const g = cv.getContext('2d');
    const E = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
    const vert = F.h > F.w, narrow = F.w < 1200;
    let cache = { name: null, bmp: null };

    // ── WebGL transitions (gl-transitions shaders) ──
    const glc = document.createElement('canvas'); glc.width = F.w; glc.height = F.h;
    const gl = glc.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
    const vsrc = 'attribute vec2 p; varying vec2 _uv; void main(){ _uv = (p + 1.0) / 2.0; gl_Position = vec4(p, 0.0, 1.0); }';
    function compile(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    const programs = {};
    for (const tr of GLT) {
      const fsrc = `precision highp float; varying vec2 _uv; uniform sampler2D from, to; uniform float progress, ratio;
        vec4 getFromColor(vec2 uv){ return texture2D(from, uv); } vec4 getToColor(vec2 uv){ return texture2D(to, uv); }
        ${tr.glsl}
        void main(){ gl_FragColor = transition(_uv); }`;
      const pr = gl.createProgram();
      gl.attachShader(pr, compile(gl.VERTEX_SHADER, vsrc)); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fsrc));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      programs[tr.name] = { pr, params: tr.params };
    }
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    function tex(unit) {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      return t;
    }
    const texA = tex(0), texB = tex(1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    function upload(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); }
    function runTransition(name, p) {
      const { pr, params } = programs[name];
      gl.viewport(0, 0, F.w, F.h); gl.useProgram(pr);
      const loc = gl.getAttribLocation(pr, 'p'); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(gl.getUniformLocation(pr, 'from'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'to'), 1);
      gl.uniform1f(gl.getUniformLocation(pr, 'progress'), p); gl.uniform1f(gl.getUniformLocation(pr, 'ratio'), F.w / F.h);
      for (const [k, v] of Object.entries(params)) {
        const l = gl.getUniformLocation(pr, k); if (!l) continue;
        if (Array.isArray(v)) (v.length === 2 ? gl.uniform2fv : v.length === 3 ? gl.uniform3fv : gl.uniform4fv).call(gl, l, v);
        else if (Number.isInteger(v) && !String(v).includes('.')) { try { gl.uniform1f(l, v); } catch { gl.uniform1i(l, v); } }
        else gl.uniform1f(l, v);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

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
      g.save(); g.globalAlpha = Math.max(0, alpha); g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(str, x, y); g.restore();
    }
    function wrap(str, font, maxW) {
      g.font = font; const out = [];
      for (const para of str.split('\n')) {
        const words = para.split(' '); let line = '';
        for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
        out.push(line);
      }
      return out;
    }
    /** Words rise and sharpen one after the other (t in seconds from the line's start). */
    function words(line, x, y, font, color, t, align = 'left', stagger = 0.06) {
      g.save(); g.font = font; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      const parts = line.split(' '); const space = g.measureText(' ').width;
      const total = g.measureText(line).width;
      let cx = align === 'center' ? x - total / 2 : x;
      parts.forEach((w, i) => {
        const k = E((t - i * stagger) / 0.5);
        if (k > 0) {
          g.globalAlpha = k; g.filter = k < 1 ? `blur(${(1 - k) * 8}px)` : 'none';
          g.fillStyle = color; g.fillText(w, cx, y + (1 - k) * 22);
        }
        cx += g.measureText(w).width + space;
      });
      g.restore();
      return parts.length;
    }
    function cursor(x, y, s) {
      g.save(); g.translate(x, y); g.scale(s, s);
      g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
      const p = new Path2D('M0 0 L0 22 L5.6 16.8 L9.4 25.4 L13 23.8 L9.3 15.4 L16.6 15.4 Z');
      g.fillStyle = '#111'; g.fill(p); g.shadowColor = 'transparent';
      g.lineWidth = 1.6; g.strokeStyle = '#fff'; g.lineJoin = 'round'; g.stroke(p);
      g.restore();
    }
    function badge(x, y, align, size, alpha = 1) {
      g.save(); g.globalAlpha = alpha; g.font = `600 ${size}px Plex`;
      const w = g.measureText(BADGE).width; const dot = size * 0.32;
      const x0 = align === 'center' ? x - (w + dot * 2 + 12) / 2 : x;
      g.fillStyle = C.accent; g.beginPath(); g.arc(x0 + dot, y - size * 0.34, dot, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.inkSoft; g.textAlign = 'left'; g.fillText(BADGE, x0 + dot * 2 + 12, y);
      g.restore();
    }

    function drawIntro(t) {
      const big = narrow ? 88 : 116; const small = narrow ? 44 : 52;
      const maxW = F.w - 140;
      const l1 = wrap(INTRO.line1, `700 ${big}px Playfair`, maxW);
      const l2 = wrap(INTRO.line2, `500 ${small}px Plex`, maxW);
      const blockH = l1.length * big * 1.08 + 40 + l2.length * small * 1.3;
      let y = F.h / 2 - blockH / 2 + big * 0.85;
      let n = 0;
      for (const ln of l1) { n += words(ln, F.w / 2, y, `700 ${big}px Playfair`, C.ink, t - n * 0.06 - 0.1, 'center'); y += big * 1.08; }
      y += 40 - big * 0.08 + small * 0.2;
      for (const ln of l2) { words(ln, F.w / 2, y, `500 ${small}px Plex`, C.accent, t - 1.3, 'center'); y += small * 1.3; }
    }

    function drawCard(st) {
      const c = st.card; const t = st.t; const L = F.left; const maxW = F.w - L * 2;
      const head = `700 ${F.head}px Playfair`, body = `500 ${F.body}px Plex`;
      const hl = wrap(c.title, head, maxW), bl = wrap(c.sub, body, maxW);
      const hH = hl.length * F.head * 1.02, bH = bl.length * F.body * 1.35;
      const blockH = F.kick * 1.2 + 44 + hH + 40 + bH;
      let y = F.h / 2 - blockH / 2 + F.kick;
      // Kicker: accent rule + "Step n · …" + progress dots.
      const ka = E(t / 0.4);
      g.save(); g.globalAlpha = ka; g.fillStyle = C.accent; g.fillRect(L, y - F.kick * 0.38, 44 * ka, 3); g.restore();
      text(c.kicker.toUpperCase(), L + 60, y, `600 ${F.kick}px Plex`, C.accent, ka, 'left');
      g.save(); g.font = `600 ${F.kick}px Plex`; const kw = g.measureText(c.kicker.toUpperCase()).width; g.restore();
      for (let i = 0; i < st.count; i++) {
        g.save(); g.globalAlpha = ka * (i === st.index ? 1 : 0.35); g.fillStyle = i <= st.index ? C.accent : C.inkSoft;
        g.beginPath(); g.arc(L + 60 + kw + 34 + i * 20, y - F.kick * 0.36, i === st.index ? 5 : 3.5, 0, Math.PI * 2); g.fill(); g.restore();
      }
      y += 44 + F.head * 0.82;
      let n = 0;
      for (const ln of hl) { n += words(ln, L, y, head, C.ink, t - 0.15 - n * 0.07, 'left', 0.07); y += F.head * 1.02; }
      y += 40 - F.head * 0.02 - F.head * 0.82 + F.body;
      const bt = t - 0.45 - n * 0.07;
      bl.forEach((ln, i) => { text(ln, L, y + (1 - E((bt - i * 0.12) / 0.5)) * 14, body, C.inkSoft, E((bt - i * 0.12) / 0.5), 'left'); y += F.body * 1.35; });
      // Footer: the brand, always with "free & open source".
      const fy = F.h - (vert ? 140 : 70);
      text('Kompyle', L, fy, `700 ${narrow ? 34 : 36}px Playfair`, C.ink, E((t - 0.3) / 0.5), 'left');
      g.save(); g.font = `700 ${narrow ? 34 : 36}px Playfair`; const ww = g.measureText('Kompyle').width; g.restore();
      badge(L + ww + 26, fy - 2, 'left', narrow ? 24 : 24, E((t - 0.3) / 0.5));
    }

    function drawOutro(t) {
      const wm = narrow ? 120 : 150; const body = narrow ? 40 : 44;
      let y = F.h / 2 - (vert ? 300 : 250);
      const a = (d) => E((t - d) / 0.45);
      text(OUTRO.wordmark, F.w / 2, y + (1 - a(0)) * 16, `700 ${wm}px Playfair`, C.ink, a(0));
      y += 110;
      const pts = OUTRO.points;
      const rows = narrow ? [[pts[0], pts[1]], [pts[2]]] : [pts];
      rows.forEach((row, r) => {
        const str = row.join('   ·   ');
        text(str, F.w / 2, y + r * body * 1.45 + (1 - a(0.25 + r * 0.12)) * 12, `500 ${body}px Plex`, C.inkSoft, a(0.25 + r * 0.12));
      });
      y += rows.length * body * 1.45 + 50;
      g.save(); g.globalAlpha = a(0.55);
      g.font = `500 ${body - 4}px Consolas, "Cascadia Code", monospace`;
      const cmd = '$ ' + OUTRO.command; const cw = g.measureText(cmd).width + 64; const ch = body + 34;
      rr(F.w / 2 - cw / 2, y - ch / 2 - body * 0.35, cw, ch, 14); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill(); g.strokeStyle = C.border; g.lineWidth = 2; g.stroke();
      g.fillStyle = C.ink; g.textAlign = 'center'; g.fillText(cmd, F.w / 2, y - body * 0.35 + body * 0.36);
      g.restore();
      y += ch + 50;
      text(OUTRO.url, F.w / 2, y + (1 - a(0.8)) * 12, `600 ${body}px Plex`, C.accent, a(0.8));
      g.save(); g.globalAlpha = a(0.8); g.font = `600 ${body}px Plex`; const uw = g.measureText(OUTRO.url).width;
      g.fillStyle = C.accent; g.fillRect(F.w / 2 - uw / 2, y + 16, uw * E((t - 0.9) / 0.6), 3); g.restore();
      y += 110;
      const sl = wrap(OUTRO.share, `500 ${narrow ? 34 : 38}px Plex`, F.w - 160);
      sl.forEach((ln, i) => words(ln, F.w / 2, y + i * 48, `500 ${narrow ? 34 : 38}px Plex`, C.ink, t - 1.4 - i * 0.2, 'center'));
    }

    async function drawApp(st) {
      if (cache.name !== st.frame) {
        const res = await fetch('http://r/' + st.frame); const blob = await res.blob();
        if (cache.bmp) cache.bmp.close();
        cache = { name: st.frame, bmp: await createImageBitmap(blob) };
      }
      const c = F.card;
      const cw = c.w, ch = c.h, cx = c.x, cy = c.y;
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 70; g.shadowOffsetY = 24;
      rr(cx, cy, cw, ch, 18); g.fillStyle = C.ground2; g.fill();
      g.shadowColor = 'transparent';
      g.save(); rr(cx, cy, cw, ch, 18); g.clip();
      const bmp = cache.bmp; const ratio = bmp.width / st.W;
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
      cursor(mx, my, (narrow ? 1.35 : 1.5) * (st.press ? 0.86 : 1));
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

      if (vert) { text('Kompyle', F.w / 2, 170, '700 72px Playfair', C.ink, 1); badge(F.w / 2, 238, 'center', 30); }
      else if (narrow) badge(F.w / 2, F.h - 26, 'center', 24);
      else badge(F.card.x, F.subY + 10, 'left', 26);
      if (st.sub && st.subAlpha > 0) {
        const font = `500 ${F.sub}px Plex`;
        const lines = wrap(st.sub, font, F.w - (narrow ? 120 : 760));
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
    }

    async function paint(st) {
      ground();
      if (st.mode === 'intro') drawIntro(st.t);
      else if (st.mode === 'outro') drawOutro(st.t);
      else if (st.mode === 'card') drawCard(st);
      else await drawApp(st);
    }

    window.draw = async (st) => {
      if (st.mode === 'trans') {
        await paint(st.a); upload(0, texA);
        await paint(st.b); upload(1, texB);
        runTransition(st.tr, st.p);
        g.drawImage(glc, 0, 0);
      } else await paint(st);
      return cv.toDataURL('image/jpeg', 0.95);
    };
  }, { F, C: COLORS, INTRO, OUTRO, BADGE, GLT: used });
  return page;
}

async function renderFormat(browser, T, fmt) {
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

/** A soft "whoosh" (filtered pink noise), generated with ffmpeg: no sample file needed. */
function whooshFile() {
  const f = path.join(OUT, 'whoosh.wav');
  if (!fs.existsSync(f)) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anoisesrc=d=0.9:c=pink:a=0.6:r=48000',
      '-af', 'highpass=f=350,lowpass=f=4200,afade=t=in:d=0.5:curve=qsin,afade=t=out:st=0.5:d=0.4:curve=qsin,aformat=channel_layouts=stereo', f]);
  }
  return f;
}

/**
 * The track if it is long enough; otherwise the track followed by its own body
 * (from 10 s), crossfaded over 4 s, so a 62 s track covers a ~100 s video.
 */
function musicInputs(music, total) {
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', music]).toString());
  if (dur >= total + 1) return { inputs: ['-i', music], chain: '[1:a]' , n: 1 };
  return { inputs: ['-i', music, '-ss', '10', '-i', music], chain: '[1:a][2:a]acrossfade=d=4:c1=qsin:c2=qsin,', n: 2 };
}

function finish(silent, fmt, T) {
  const total = T.total;
  const final = path.join(OUT, `kompyle-demo-${fmt}.mp4`);
  const music = path.join(ROOT, 'assets', 'music.mp3');
  const fade = Math.max(0, total - 2.5).toFixed(2);
  const wh = whooshFile();
  const args = ['-y', '-loglevel', 'error', '-i', silent];
  let filter, base;
  if (fs.existsSync(music)) {
    const m = musicInputs(music, total);
    args.push(...m.inputs);
    base = 1 + m.n;
    filter = `${m.chain}${m.chain.endsWith(',') ? '' : 'anull,'}atrim=0:${total.toFixed(2)},volume=0.35,afade=t=in:d=1.2,afade=t=out:st=${fade}:d=2.5,aformat=sample_rates=48000:channel_layouts=stereo[m]`;
  } else {
    args.push('-f', 'lavfi', '-t', total.toFixed(2), '-i', 'anullsrc=r=48000:cl=stereo');
    base = 2;
    filter = '[1:a]anull[m]';
  }
  // One whoosh per transition, centred on it.
  const times = T.transitions;
  times.forEach(() => args.push('-i', wh));
  times.forEach((t, i) => { const ms = Math.max(0, Math.round((t - 0.45) * 1000)); filter += `;[${base + i}:a]volume=0.22,adelay=${ms}|${ms}[w${i}]`; });
  filter += `;[m]${times.map((_, i) => `[w${i}]`).join('')}amix=inputs=${times.length + 1}:normalize=0:duration=first[a]`;
  args.push('-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(2), '-movflags', '+faststart', final);
  execFileSync('ffmpeg', args);
  fs.rmSync(silent);
  return final;
}

(async () => {
  const tl = JSON.parse(fs.readFileSync(path.join(CAP, 'timeline.json'), 'utf8'));
  const T = buildTimeline(tl);
  console.log(`app ${T.appDur.toFixed(1)}s, total ${T.total.toFixed(1)}s, ${T.transitions.length} transitions, formats: ${formats.join(', ')}${PREVIEW ? ' (preview)' : ''}`);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const fmt of formats) {
    const final = THUMBS_ONLY ? path.join(OUT, `kompyle-demo-${fmt}.mp4`) : finish(await renderFormat(browser, T, fmt), fmt, T);
    // Thumbnail: the ATS score close-up (first tight camera of the "ats" scene, once settled).
    const ats = T.blocks.find((b) => b.type === 'app' && b.scene === 'ats');
    const close = ats ? T.cams.find((c) => c.u > ats.u0 && c.u < ats.u1 && c.h <= 720) : null;
    const thumbAt = close ? T.uToT(close.u) + close.ease + 0.6 : T.total / 2;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', thumbAt.toFixed(2), '-i', final, '-frames:v', '1', path.join(OUT, `kompyle-demo-${fmt}.png`)]);
    console.log('wrote', path.relative(ROOT, final));
  }
  await browser.close();
})();
