'use strict';
/**
 * Capture helpers: a CDP screencast that saves every frame with its timestamp,
 * and a "director" that moves the mouse with eased curves, types like a human
 * and logs every cursor position and click (used later for the cursor overlay
 * and the camera zooms). The cursor itself is NOT drawn in the page: the
 * compositor draws it at 30 fps from the log, so it stays perfectly smooth.
 */
const fs = require('fs');
const path = require('path');

const now = () => Date.now() / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function startScreencast(page, outDir, { width, height }) {
  fs.mkdirSync(outDir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let n = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const file = `f${String(n++).padStart(6, '0')}.jpg`;
    fs.writeFileSync(path.join(outDir, file), Buffer.from(f.data, 'base64'));
    frames.push({ t: f.metadata.timestamp, file });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closed */ }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  return {
    frames,
    async stop() { try { await cdp.send('Page.stopScreencast'); } catch { /* closed */ } },
  };
}

function createDirector(page) {
  const log = { moves: [], clicks: [], marks: [], keys: [] };
  let pos = { x: 960, y: 600 };

  async function moveTo(x, y, ms, mouseSteps = 1) {
    const from = { ...pos };
    const dist = Math.hypot(x - from.x, y - from.y);
    const dur = ms ?? Math.min(900, Math.max(350, dist * 0.9));
    // Slight arc so the path does not look robotic.
    const nx = -(y - from.y) / (dist || 1), ny = (x - from.x) / (dist || 1);
    const bend = Math.min(60, dist * 0.08);
    // The path is only logged (the compositor draws the cursor); the real mouse
    // jumps to the target at the end. Real per-step moves re-render hover states
    // and are very slow on a 4K screencast (a 1 s move could take 4 s).
    const steps = Math.max(8, Math.round(dur / 16));
    const t0 = now();
    for (let i = 1; i <= steps; i++) {
      const k = easeInOut(i / steps);
      const arc = Math.sin(Math.PI * k) * bend;
      log.moves.push({ t: t0 + (dur / 1000) * (i / steps), x: from.x + (x - from.x) * k + nx * arc, y: from.y + (y - from.y) * k + ny * arc });
    }
    await sleep(dur);
    await page.mouse.move(x, y, { steps: mouseSteps });
    log.moves.push({ t: now(), x, y });
    pos = { x, y };
  }

  async function box(locator, label) {
    const el = typeof locator === 'string' ? page.locator(locator).first() : locator;
    await el.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      throw new Error(`not visible: ${label}`);
    });
    await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox();
    if (!b) throw new Error(`no box: ${label}`);
    return { el, b };
  }

  async function click(locator, label, { zoom = 0, pause = 700, dx = 0.5, dy = 0.5 } = {}) {
    const { b } = await box(locator, label);
    const x = b.x + b.width * dx, y = b.y + b.height * dy;
    await moveTo(x, y);
    await sleep(220);
    await page.mouse.down();
    log.clicks.push({ t: now(), x, y, label, zoom, box: b });
    await sleep(70);
    await page.mouse.up();
    console.log(`click ${label} @${Math.round(x)},${Math.round(y)}`);
    await sleep(pause);
  }

  /** Click (or double-click with count: 2) at page coordinates. */
  async function clickAt(x, y, label, { pause = 500, count = 1 } = {}) {
    await moveTo(x, y);
    await sleep(200);
    for (let i = 1; i <= count; i++) {
      await page.mouse.down({ clickCount: i });
      if (i === 1) log.clicks.push({ t: now(), x, y, label });
      await sleep(40);
      await page.mouse.up({ clickCount: i });
      if (i < count) await sleep(60);
    }
    console.log(`click ${label} @${Math.round(x)},${Math.round(y)}`);
    await sleep(pause);
  }

  /** Press at (x1, y1), drag to (x2, y2), release: a text selection. */
  async function drag(x1, y1, x2, y2, label, { ms = 700, pause = 400 } = {}) {
    await moveTo(x1, y1);
    await sleep(150);
    await page.mouse.down();
    log.clicks.push({ t: now(), x: x1, y: y1, label });
    await moveTo(x2, y2, ms, 6);
    await page.mouse.up();
    console.log(`drag ${label}`);
    await sleep(pause);
  }

  async function type(text, { min = 28, max = 70 } = {}) {
    for (const ch of text) {
      await page.keyboard.type(ch);
      log.keys.push({ t: now() });
      let d = min + Math.random() * (max - min);
      if (ch === ' ') d += 30;
      if (/[.,!?]/.test(ch)) d += 140;
      await sleep(d);
    }
  }

  function mark(name, extra = {}) {
    log.marks.push({ t: now(), name, ...extra });
    console.log(`mark ${name}`);
  }

  return { log, moveTo, click, clickAt, drag, type, mark, box, get pos() { return pos; } };
}

module.exports = { startScreencast, createDirector, sleep, now };
