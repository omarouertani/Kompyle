'use strict';
/**
 * Designed thumbnails for the square and vertical videos: headline + the 16:9
 * ATS-score frame on the app's dark ground (a cropped frame reads badly there).
 * Run after render.cjs (it needs out/video/kompyle-demo-16x9.png).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { COLORS: C, FORMATS } = require('./lib/story.cjs');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const OUT = path.join(ROOT, 'out', 'video');
const shot = path.join(OUT, 'kompyle-demo-16x9.png');
const url = (p) => 'file:///' + p.replace(/\\/g, '/');

function html(F) {
  const vert = F.h > F.w;
  return `<!doctype html><html><head><style>
  @font-face{font-family:Plex;src:url('${url(path.join(REPO, 'node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2'))}');font-weight:100 700}
  @font-face{font-family:Playfair;src:url('${url(path.join(REPO, 'public/fonts/playfairdisplay/PlayfairDisplay-Bold.ttf'))}');font-weight:700}
  html,body{margin:0;width:${F.w}px;height:${F.h}px;overflow:hidden}
  body{background:radial-gradient(circle at 18% 8%,rgba(216,119,87,.12),transparent 60%),linear-gradient(135deg,${C.ground2},${C.ground});
    background-color:${C.ground};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${vert ? 90 : 56}px;font-family:Plex;color:${C.ink}}
  body:before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(250,248,241,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(250,248,241,.035) 1px,transparent 1px);background-size:48px 48px}
  .t{position:relative;text-align:center;padding:0 60px}
  .wm{font:700 ${vert ? 64 : 48}px Playfair;color:${C.accent};margin-bottom:${vert ? 36 : 22}px}
  h1{font:700 ${vert ? 104 : 80}px/1.04 Playfair;margin:0;letter-spacing:-.01em}
  p{font:500 ${vert ? 46 : 36}px Plex;color:${C.inkSoft};margin:${vert ? 34 : 22}px 0 0}
  img{position:relative;width:${F.w - 120}px;border-radius:18px;border:1.5px solid rgba(250,248,241,.12);box-shadow:0 24px 70px rgba(0,0,0,.55)}
  </style></head><body><div class="t"><div class="wm">Kompyle</div><h1>One CV for<br>every job?</h1>
  <p>Tailor it to the offer in seconds.<br>Free &amp; open source.</p></div>
  <img src="${url(shot)}"></body></html>`;
}

(async () => {
  if (!fs.existsSync(shot)) throw new Error('Render the 16x9 video first (missing ' + shot + ')');
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  for (const fmt of ['1x1', '9x16']) {
    const F = FORMATS[fmt];
    const page = await browser.newPage({ viewport: { width: F.w, height: F.h } });
    const file = path.join(OUT, `thumb-${fmt}.html`);
    fs.writeFileSync(file, html(F));
    await page.goto(url(file));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `kompyle-demo-${fmt}.png`) });
    fs.rmSync(file);
    await page.close();
    console.log('wrote', `out/video/kompyle-demo-${fmt}.png`);
  }
  await browser.close();
})();
