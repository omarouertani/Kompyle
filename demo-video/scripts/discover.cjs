const { chromium } = require('playwright');
const path = require('path');
const { BASE_URL, newAppContext, polish } = require('./lib/app.cjs');
const OUT = path.join(__dirname, '..', 'out', 'discover');
(async () => {
  const b = await chromium.launch();
  const ctx = await newAppContext(b, { scheme: process.env.SCHEME || 'dark' });
  const p = await ctx.newPage();
  await p.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
  await polish(p);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(OUT, `home-${process.env.SCHEME || 'dark'}.png`) });
  const els = await p.evaluate(() => Array.from(document.querySelectorAll('button,textarea,[data-tour]')).filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return `${e.tagName} tour=${e.getAttribute('data-tour')||''} aria=${e.getAttribute('aria-label')||''} txt="${(e.textContent||'').trim().slice(0,30)}" @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`; }).filter(s => !/txt="" @/.test(s) || /aria=\S/.test(s)).slice(0,60));
  console.log(els.join('\n'));
  await b.close();
})();
