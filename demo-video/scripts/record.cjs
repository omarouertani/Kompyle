'use strict';
/**
 * Records the Kompyle demo: CDP screencast (2048x1152, deviceScaleFactor 2)
 * + a log of cursor moves, clicks, scene marks, camera keyframes and AI waits.
 * Output: out/capture/frames/*.jpg + out/capture/timeline.json
 *
 * 2048 px wide (not 1920): at 1920 px the canvas toolbar overlaps "Theme" and
 * "Sections" while the AI panel is open.
 *
 *   node scripts/record.cjs            (scripted AI answers, see lib/ai-mock.cjs)
 *   DEMO_AI=live node scripts/record.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { BASE_URL, LIVE_AI, newAppContext, polish } = require('./lib/app.cjs');
const { installAiMock } = require('./lib/ai-mock.cjs');
const { startScreencast, createDirector, sleep, now } = require('./lib/capture.cjs');

const W = 2048, H = 1152, SCALE = 1.5;
const OUT = path.join(__dirname, '..', 'out', 'capture');
const offer = fs.readFileSync(path.join(__dirname, '..', 'data', 'job-offer.txt'), 'utf8');
// Typed on camera into the API Keys dialog. Not a key: the field masks it and, in mock mode, nothing is sent.
const FAKE_KEY = 'demo-not-a-real-key';

/** Bounding box of a phrase inside the CV page (for drag-selecting it). */
async function phraseBox(page, phrase) {
  return page.evaluate((phrase) => {
    const root = document.querySelector('[data-tour=cv-page]');
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const i = n.data.indexOf(phrase);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i); r.setEnd(n, i + phrase.length);
      const rects = Array.from(r.getClientRects());
      const a = rects[0], b = rects[rects.length - 1];
      return { x1: a.left + 1, y1: a.top + a.height / 2, x2: b.right - 1, y2: b.top + b.height / 2 };
    }
    return null;
  }, phrase);
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  const ctx = await newAppContext(browser, { width: W, height: H, scale: SCALE, keys: false });
  const page = await ctx.newPage();
  if (!LIVE_AI) await installAiMock(page, { delay: 3200 });

  await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
  await polish(page);
  await page.waitForTimeout(2500);

  const cast = await startScreencast(page, path.join(OUT, 'frames'), { width: W * SCALE, height: H * SCALE });
  const d = createDirector(page);
  const cam = (cx, cy, h, ease = 0.9) => d.mark('cam', { cx, cy, h, ease });
  // Camera on a box: centre of the box, tall enough to hold it with a margin.
  const camOn = (b, { pad = 1.25, ease = 0.9, minH = 440 } = {}) =>
    cam(b.x + b.width / 2, b.y + b.height / 2, Math.min(H, Math.max(minH, b.height * pad, (b.width * pad * 9) / 16)), ease);
  const full = (ease = 0.9) => cam(W / 2, H / 2, H, ease);
  const scene = (name) => d.mark('scene', { scene: name });
  const tStart = now();
  await page.mouse.move(1300, 640);
  await sleep(400);

  try {
    // 1. Overview ────────────────────────────────────────────────────────────
    scene('overview');
    full(0);
    await sleep(700);
    await d.moveTo(1260, 320, 900);
    cam(1260, 520, 900, 1.6);
    await d.moveTo(1380, 450, 1000);
    await sleep(700);

    // 2. A free AI key ──────────────────────────────────────────────────────
    scene('keys');
    full(0);
    await sleep(300);
    await d.click('[data-tour=api-keys] button', 'API Keys', { pause: 700 });
    const dlg = (await d.box('[role=alertdialog]', 'API Keys dialog')).b;
    camOn(dlg, { pad: 1.08, ease: 0.8 });
    await sleep(600);
    // Point at the "Free" badges.
    // (one evaluate: per-element locators are slow while the 4K screencast runs)
    const badges = await page.evaluate(() => Array.from(document.querySelectorAll('[role=alertdialog] span'))
      .filter((e) => e.textContent.trim() === 'Free').map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
    for (const b of badges) {
      await d.moveTo(b.x + 14, b.y + 4, 320);
      await sleep(100);
    }
    const inputs = page.locator('[role=alertdialog] input');
    for (const i of [0, 2]) {
      const empty = !(await inputs.nth(i).inputValue());
      await d.click(inputs.nth(i), `key field ${i}`, { pause: 250 });
      if (empty) { d.mark('ff-start'); await d.type(FAKE_KEY, { min: 8, max: 18 }); d.mark('ff-end'); }
      await sleep(350);
    }
    await sleep(500);
    await d.click(page.locator('[role=alertdialog] button', { hasText: 'Done' }), 'Done', { pause: 600 });
    // The model picker: providers marked "Free".
    const combo = page.locator('[data-tour=composer] [role=combobox]').first();
    const cb = (await d.box(combo, 'model picker')).b;
    cam(260, 820, 640, 0.9);
    await d.click(combo, 'model picker', { pause: 700 });
    const menu = (await d.box('[role=listbox]', 'model menu')).b;
    camOn({ x: menu.x, y: menu.y, width: menu.width + 120, height: menu.height + (cb.y + cb.height - menu.y - menu.height) }, { pad: 1.12, ease: 0.7 });
    await d.moveTo(menu.x + menu.width - 40, menu.y + menu.height * 0.35, 700);
    await sleep(500);
    await d.moveTo(menu.x + menu.width * 0.4, menu.y + menu.height - 18, 800);
    await sleep(900);
    await page.keyboard.press('Escape');
    await sleep(400);

    // 3. Paste the job offer ────────────────────────────────────────────────
    scene('paste');
    const comp = (await d.box('[data-tour=composer]', 'composer')).b;
    camOn(comp, { pad: 1.5, ease: 0 });
    await d.click('[data-tour=composer] textarea', 'job offer field', { pause: 350 });
    d.mark('key', { label: 'Ctrl + V' });
    await page.keyboard.insertText(offer);
    await sleep(1300);
    await d.click(page.getByRole('button', { name: 'Adapt CV' }), 'Adapt CV', { pause: 200 });

    // 4. AI adapts the CV ───────────────────────────────────────────────────
    scene('adapt');
    const pg = () => d.box('[data-tour=cv-page]', 'cv page').then((r) => r.b);
    let p = await pg();
    cam(p.x + p.width / 2, 640, 760, 0.8);
    d.mark('wait-start');
    await page.getByText('Your CV has been adapted').first().waitFor({ timeout: 180000 });
    d.mark('wait-end');
    await sleep(300);
    p = await pg();
    cam(p.x + p.width / 2, p.y + 250, 560, 1.0);
    await d.moveTo(p.x + 260, p.y + 80, 700);
    await sleep(800);
    await d.moveTo(p.x + 560, p.y + 190, 1000);
    await sleep(700);
    cam(p.x + p.width * 0.62, p.y + 420, 600, 1.0);
    await d.moveTo(p.x + 520, p.y + 330, 900);
    await sleep(1300);

    // 5. Cover letter ───────────────────────────────────────────────────────
    scene('letter');
    full(0);
    await d.click(page.getByRole('button', { name: 'Write the letter' }), 'Write the letter', { pause: 200 });
    d.mark('wait-start');
    await page.getByText('Your cover letter is ready').first().waitFor({ timeout: 180000 });
    d.mark('wait-end');
    await sleep(300);
    // The letter page spans about x 686-1314, y 191-895 at 2048x1152.
    cam(1000, 560, 720, 1.0);
    await d.moveTo(1000, 580, 900);
    await sleep(2000);

    // 6. ATS check ──────────────────────────────────────────────────────────
    scene('ats');
    full(0);
    await d.click(page.getByRole('button', { name: 'Check the ATS' }).first(), 'Check the ATS', { pause: 700 });
    await d.click(page.getByRole('button', { name: 'Start an audit' }), 'Start an audit', { pause: 500 });
    cam(W / 2, H / 2, 820, 0.8);
    await sleep(500);
    await d.click(page.getByRole('button', { name: 'Run ATS audit' }), 'Run ATS audit', { pause: 100 });
    d.mark('wait-start');
    await page.getByText('Strong match').first().waitFor({ timeout: 180000 });
    d.mark('wait-end');
    await sleep(400);
    const score = (await d.box(page.getByText('Strong match').first(), 'score')).b;
    cam(score.x + 260, score.y + 60, 700, 1.0);
    await d.moveTo(score.x + 40, score.y + 10, 800);
    await sleep(1500);
    cam(score.x + 260, score.y + 380, 700, 1.0);
    await d.moveTo(score.x + 120, score.y + 330, 1000);
    await sleep(500);
    await d.moveTo(score.x + 420, score.y + 460, 900);
    await sleep(1200);

    // 7. Make it yours: canvas edits, toolbar, templates, colours ────────────
    scene('edit');
    full(0);
    await d.click(page.locator('[data-tour=doc-tabs] button', { hasText: 'CV Preview' }), 'CV Preview', { pause: 900 });
    // Select a phrase on the page, then bold + highlight it from the toolbar.
    const ph = await phraseBox(page, 'fintech products');
    if (!ph) throw new Error('phrase not found on the CV page');
    const tb = (await d.box('[data-tour=canvas-toolbar]', 'toolbar')).b;
    const bold = (await d.box('[title="Bold (Ctrl+B)"]', 'Bold')).b;
    cam((bold.x + ph.x2) / 2, (tb.y + ph.y1) / 2 + 30, Math.max(480, ph.y1 - tb.y + 260, ((ph.x2 - bold.x + 260) * 9) / 16), 1.0);
    await d.drag(ph.x1, ph.y1, ph.x2, ph.y2, 'select phrase', { ms: 750 });
    await d.click('[title="Bold (Ctrl+B)"]', 'Bold', { pause: 450 });
    await d.click('[title="Highlight"]', 'Highlight', { pause: 500 });
    await d.click(page.locator('.popover-surface button, [role=dialog] button').filter({ hasNot: page.locator('text=None') }).first(), 'yellow', { pause: 600 });
    await d.clickAt(1850, 1000, 'deselect', { pause: 700 });
    // Templates.
    full(0.9);
    await d.click('[title=Template]', 'Template', { pause: 700 });
    const tmenu = (await d.box(page.getByRole('group').filter({ has: page.getByRole('option', { name: /Creative/ }) }).first(), 'template menu')).b;
    camOn({ x: tmenu.x, y: tmenu.y - 40, width: tmenu.width, height: tmenu.height + 40 }, { pad: 1.2, ease: 0.8 });
    await d.moveTo(tmenu.x + tmenu.width * 0.5, tmenu.y + tmenu.height * 0.4, 700);
    await sleep(300);
    await d.click(page.getByRole('option', { name: /Creative/ }), 'Creative', { pause: 1200 });
    full(0.9);
    await d.moveTo(1300, 600, 800);
    await sleep(900);
    // Colours.
    await d.click('[title="Theme & dimensions"]', 'Theme', { pause: 700 });
    const blue = (await d.box(page.getByRole('button', { name: /Corporate Blue/ }).first(), 'Corporate Blue')).b;
    cam(blue.x + 330, blue.y + 160, 620, 0.9);
    await d.click(page.getByRole('button', { name: /Corporate Blue/ }).first(), 'Corporate Blue', { pause: 900 });
    await page.keyboard.press('Escape');
    await sleep(300);
    full(0.9);
    await d.moveTo(1350, 560, 800);
    await sleep(1100);

    // 8. Export ─────────────────────────────────────────────────────────────
    scene('finish');
    cam(1700, 330, 640, 0);
    await d.click(page.locator('[data-tour=export] button'), 'Export', { pause: 600 });
    await d.moveTo(1880, 230, 600);
    await sleep(1800);
    scene('end');
  } catch (e) {
    console.error('RECORD ERROR:', e.message);
    await page.screenshot({ path: path.join(OUT, 'error.png') });
    process.exitCode = 1;
  } finally {
    await cast.stop();
    const tEnd = now();
    await ctx.close();
    await browser.close();
    const timeline = { width: W, height: H, scale: SCALE, tStart, tEnd, frames: cast.frames, ...d.log };
    fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline));
    const dur = tEnd - tStart;
    console.log(`frames=${cast.frames.length} duration=${dur.toFixed(1)}s avg fps=${(cast.frames.length / dur).toFixed(1)}`);
  }
})();
