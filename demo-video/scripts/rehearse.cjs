// Rehearsal: runs the demo flow without recording and screenshots each step.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { BASE_URL, LIVE_AI, newAppContext, polish } = require('./lib/app.cjs');
const { installAiMock } = require('./lib/ai-mock.cjs');
const OUT = path.join(__dirname, '..', 'out', 'rehearse'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const offer = fs.readFileSync(path.join(__dirname, '..', 'data', 'job-offer.txt'), 'utf8');
(async () => {
  const b = await chromium.launch();
  const ctx = await newAppContext(b);
  const p = await ctx.newPage();
  if (!LIVE_AI) await installAiMock(p, { delay: 2500 });
  let i = 0; const shot = async (n) => p.screenshot({ path: path.join(OUT, `${String(i++).padStart(2,'0')}-${n}.png`) });
  const dump = async (sel) => console.log(sel, '=>', (await p.locator(sel).locator('button:visible').allInnerTexts()).map(s=>s.trim()).filter(Boolean).join(' | '));
  await p.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' }); await polish(p); await p.waitForTimeout(1500);
  await p.locator('textarea').first().click(); await p.keyboard.insertText(offer); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'Adapt CV' }).click();
  await p.waitForTimeout(1200); await shot('adapting');
  await p.waitForTimeout(4000); await shot('adapted');
  await dump('body');
  await p.locator('[data-tour=ats-tab]').click(); await p.waitForTimeout(1500); await shot('ats-tab');
  await dump('main');
  await b.close();
})();
