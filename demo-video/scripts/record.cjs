'use strict';
/**
 * Records the Kompyle demo: CDP screencast (1920x1080, deviceScaleFactor 2)
 * + a log of cursor moves, clicks, scene marks, camera keyframes and AI waits.
 * Output: out/capture/frames/*.jpg + out/capture/timeline.json
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

const W = 1920, H = 1080, SCALE = 2;
const OUT = path.join(__dirname, '..', 'out', 'capture');
const offer = fs.readFileSync(path.join(__dirname, '..', 'data', 'job-offer.txt'), 'utf8');

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  const ctx = await newAppContext(browser, { width: W, height: H, scale: SCALE });
  const page = await ctx.newPage();
  if (!LIVE_AI) await installAiMock(page, { delay: 3200 });

  await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
  await polish(page);
  await page.waitForTimeout(2500);

  const cast = await startScreencast(page, path.join(OUT, 'frames'), { width: W * SCALE, height: H * SCALE });
  const d = createDirector(page);
  const cam = (cx, cy, h, ease = 0.9) => d.mark('cam', { cx, cy, h, ease });
  const scene = (name) => d.mark('scene', { scene: name });
  const tStart = now();
  await page.mouse.move(1250, 640);
  await sleep(400);

  try {
    // 1. Overview ────────────────────────────────────────────────────────────
    scene('overview');
    cam(960, 540, 1080, 0);
    await sleep(900);
    await d.moveTo(1180, 300, 900);
    cam(1200, 470, 860, 1.6);
    await d.moveTo(1300, 420, 1100);
    await sleep(900);

    // 2. Paste the job offer ────────────────────────────────────────────────
    scene('paste');
    cam(300, 830, 560, 1.0);
    await d.click('[data-tour=composer] textarea', 'job offer field', { pause: 350 });
    d.mark('key', { label: 'Ctrl + V' });
    await page.keyboard.insertText(offer);
    await sleep(1300);
    await d.click(page.getByRole('button', { name: 'Adapt CV' }), 'Adapt CV', { pause: 200 });

    // 3. AI adapts the CV ───────────────────────────────────────────────────
    scene('adapt');
    cam(1200, 620, 720, 0.8);
    d.mark('wait-start');
    await page.getByText('Your CV has been adapted').first().waitFor({ timeout: 180000 });
    d.mark('wait-end');
    await sleep(300);
    cam(1190, 400, 620, 1.0);
    await d.moveTo(1120, 312, 700);
    await sleep(900);
    await d.moveTo(1400, 430, 1000);
    await sleep(700);
    cam(1300, 570, 640, 1.0);
    await d.moveTo(1350, 560, 900);
    await sleep(1400);

    // 4. Cover letter ───────────────────────────────────────────────────────
    scene('letter');
    cam(960, 540, 1080, 0.9);
    await d.click(page.getByRole('button', { name: 'Write the letter' }), 'Write the letter', { pause: 200 });
    d.mark('wait-start');
    await page.getByText('Your cover letter is ready').first().waitFor({ timeout: 180000 });
    d.mark('wait-end');
    await sleep(300);
    cam(1200, 720, 700, 1.0);
    await d.moveTo(1200, 700, 900);
    await sleep(2200);

    // 5. ATS check ──────────────────────────────────────────────────────────
    scene('ats');
    cam(960, 540, 1080, 0.9);
    await d.click(page.getByRole('button', { name: 'Check the ATS' }).first(), 'Check the ATS', { pause: 700 });
    await d.click(page.getByRole('button', { name: 'Start an audit' }), 'Start an audit', { pause: 500 });
    cam(960, 540, 760, 0.8);
    await sleep(500);
    await d.click(page.getByRole('button', { name: 'Run ATS audit' }), 'Run ATS audit', { pause: 100 });
    d.mark('wait-start');
    await page.getByText('Strong match').first().waitFor({ timeout: 180000 });
    d.mark('wait-end');
    await sleep(300);
    cam(600, 330, 660, 1.0);
    await d.moveTo(330, 300, 800);
    await sleep(1700);
    cam(600, 660, 640, 1.0);
    await d.moveTo(100, 614, 1000);
    await sleep(500);
    await d.moveTo(420, 744, 900);
    await sleep(1300);

    // 6. Theme + export ─────────────────────────────────────────────────────
    scene('finish');
    cam(960, 540, 1080, 0.9);
    await d.click(page.locator('[data-tour=doc-tabs] button', { hasText: 'CV Preview' }), 'CV Preview', { pause: 900 });
    await d.click(page.locator('[data-tour=canvas-toolbar] button', { hasText: 'Theme' }), 'Theme', { pause: 600 });
    cam(760, 560, 900, 0.9);
    await d.click(page.getByRole('button', { name: /Corporate Blue/ }).first(), 'Corporate Blue', { pause: 700 });
    await page.keyboard.press('Escape');
    await sleep(500);
    await d.moveTo(1250, 480, 800);
    await sleep(900);
    cam(1560, 330, 700, 1.0);
    await d.click(page.locator('[data-tour=export] button'), 'Export', { pause: 600 });
    await d.moveTo(1760, 200, 600);
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
