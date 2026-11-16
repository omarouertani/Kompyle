'use strict';
/** Shared app setup: fresh browser context on the isolated demo instance. */
const { openrouterKey } = require("./keys.cjs");
const BASE_URL = process.env.BASE_URL || 'http://localhost:3100';
const MODEL = process.env.DEMO_MODEL || 'openrouter/free';
const LIVE_AI = process.env.DEMO_AI === 'live';
// In mock mode a placeholder key only hides the "no key" hint: requests are intercepted and never leave the machine.
const browserKey = () => (LIVE_AI ? { openrouter: openrouterKey() } : { openrouter: 'demo-placeholder', google: 'demo-placeholder', groq: 'demo-placeholder', nvidia: 'demo-placeholder' });

/** keys: false starts with no API key (mock mode only): the demo then types a fake one on camera. */
async function newAppContext(browser, { scheme = 'dark', width = 1920, height = 1080, scale = 1, keys = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: scheme, locale: 'en-US' });
  await ctx.addInitScript(([model, scheme, key]) => {
    try {
      if (!localStorage.getItem('__demo_init')) {
        localStorage.setItem('__demo_init', '1');
        localStorage.setItem('kompyle_tour_v1', 'done');
        localStorage.setItem('kompyle_seen_version', '999.0.0');
        localStorage.setItem('kompyle_ai_model', model);
        localStorage.setItem('theme', scheme);
        if (key) localStorage.setItem('kompyle.apiKeys', JSON.stringify(key));
      }
    } catch { /* storage unavailable */ }
  }, [MODEL, scheme, keys || LIVE_AI ? browserKey() : null]);
  return ctx;
}

/** Hide dev-only noise (toasts are kept: they are part of the product). */
async function polish(page) {
  await page.addStyleTag({ content: `nextjs-portal{display:none!important} *{scrollbar-width:none!important} ::-webkit-scrollbar{display:none!important}` });
}

module.exports = { BASE_URL, MODEL, LIVE_AI, newAppContext, polish };
