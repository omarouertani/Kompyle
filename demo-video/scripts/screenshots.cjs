'use strict';
/**
 * Refreshes the README screenshots (docs/screenshots) from the isolated demo
 * instance: fictional Jane Doe data only, scripted AI answers (lib/ai-mock.cjs).
 *
 *   node scripts/screenshots.cjs
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BASE_URL, newAppContext, polish } = require('./lib/app.cjs');
const { installAiMock } = require('./lib/ai-mock.cjs');

const REPO = path.join(__dirname, '..', '..');
const DEST = path.join(REPO, 'docs', 'screenshots');
const TMP = path.join(__dirname, '..', 'out', 'screens');
const VIEW = { width: 1920, height: 1080 };
const offer = fs.readFileSync(path.join(__dirname, '..', 'data', 'job-offer.txt'), 'utf8');
const release = JSON.parse(fs.readFileSync(path.join(REPO, 'release.json'), 'utf8'));

fs.mkdirSync(TMP, { recursive: true });

/** Saves a 2x capture, scaled to `width`, as PNG or WebP. */
function save(raw, name, width) {
  const out = path.join(DEST, name);
  const vf = `scale=${width}:-1:flags=lanczos`;
  const codec = name.endsWith('.webp') ? ['-c:v', 'libwebp', '-quality', '88', '-compression_level', '6'] : ['-compression_level', '9'];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', vf, ...codec, out]);
  console.log('wrote', path.relative(REPO, out));
}

async function shot(page, name, width, clip) {
  const raw = path.join(TMP, name.replace(/\.\w+$/, '.png'));
  await page.screenshot({ path: raw, clip });
  save(raw, name, width);
}

/** Bounding box of several locators, padded and kept inside the viewport. */
async function around(page, locators, pad = 16) {
  const boxes = [];
  for (const l of locators) { const b = await l.boundingBox(); if (b) boxes.push(b); }
  const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  const x1 = Math.min(VIEW.width, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
  const y1 = Math.min(VIEW.height, Math.max(...boxes.map((b) => b.y + b.height)) + pad);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

async function open(browser, scheme, { tour = false, update = false } = {}) {
  const ctx = await newAppContext(browser, { scheme, ...VIEW, scale: 2 });
  if (tour) await ctx.addInitScript(() => { try { localStorage.removeItem('kompyle_tour_v1'); localStorage.removeItem('kompyle_seen_version'); } catch {} });
  const page = await ctx.newPage();
  await installAiMock(page, { delay: 600 });
  if (update) await page.route('**/api/update-check', (route) => route.fulfill({ json: {
    enabled: true, current: '0.1.0', latest: release.releases[0].version, updateAvailable: true,
    releases: release.releases.filter((r) => r.version !== '0.1.0'), repository: release.repository,
  } }));
  await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
  await polish(page);
  await page.waitForTimeout(1500);
  return { ctx, page };
}

async function adapt(page) {
  await page.locator('[data-tour=composer] textarea').click();
  await page.keyboard.insertText(offer);
  await page.getByRole('button', { name: 'Adapt CV' }).click();
  await page.getByText('Your CV has been adapted').first().waitFor();
  await page.mouse.move(VIEW.width - 5, VIEW.height / 2);
  await page.waitForTimeout(5500); // let the toast leave
}

(async () => {
  const browser = await chromium.launch();

  // Light theme: import dialog and the "Update available" panel (simulated newer release).
  {
    const { ctx, page } = await open(browser, 'light', { update: true });
    await page.getByRole('button', { name: 'Import my existing CV' }).click();
    const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog')).first();
    await dialog.waitFor(); await page.waitForTimeout(500);
    await shot(page, 'import-dialog.png', 700, await around(page, [dialog], 0));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);

    await page.getByRole('button', { name: /^Update v/ }).click(); await page.waitForTimeout(500);
    const panel = page.locator('.popover-surface:visible').first();
    await shot(page, 'update-badge.png', 760, await around(page, [panel, page.getByRole('button', { name: /^Update v/ })], 14));
    await ctx.close();
  }

  // Light theme: editor, templates, export, letter, ATS.
  {
    const { ctx, page } = await open(browser, 'light');
    await adapt(page);
    await shot(page, 'editor-light.webp', 1800);

    const tpl = page.locator('[title="Template"]').first();
    await tpl.click(); await page.waitForTimeout(600);
    const list = page.locator('[role=listbox]:visible, [role=menu]:visible, [data-slot=select-content]:visible').first();
    await shot(page, 'templates.png', 520, await around(page, [list, tpl], 14));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);

    await page.locator('[data-tour=export] button').click(); await page.waitForTimeout(500);
    const menu = page.locator('.popover-surface:visible').first();
    await shot(page, 'export-menu.png', 720, await around(page, [menu, page.locator('[data-tour=export] button')], 14));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);

    await page.getByRole('button', { name: 'Write the letter' }).click();
    await page.getByText('Your cover letter is ready').first().waitFor();
    await page.waitForTimeout(5500);
    await shot(page, 'cover-letter.png', 1800);

    await page.getByRole('button', { name: 'Check the ATS' }).first().click(); await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Start an audit' }).click(); await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Run ATS audit' }).click();
    await page.getByText('Strong match').first().waitFor();
    await page.waitForTimeout(1500);
    await shot(page, 'ats-checker.png', 1800);
    await ctx.close();
  }

  // Dark theme editor.
  {
    const { ctx, page } = await open(browser, 'dark');
    await adapt(page);
    await shot(page, 'editor-dark.webp', 1800);
    await ctx.close();
  }

  // Guided tour (first-visit state), on its third step.
  {
    const { ctx, page } = await open(browser, 'light', { tour: true });
    for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: 'Next' }).click(); await page.waitForTimeout(700); }
    await shot(page, 'guided-tour.png', 1800);
    await ctx.close();
  }

  await browser.close();
})();
