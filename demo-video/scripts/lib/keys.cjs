'use strict';
/** Reads the OpenRouter key from ../.env.local (or env) WITHOUT printing it.
 *  It is injected into the browser's localStorage (BYOK store) so the AI works,
 *  but the API Keys dialog is never opened on camera. */
const fs = require('fs');
const path = require('path');
function openrouterKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', '..', '..', '.env.local'), 'utf8');
    const m = raw.match(/^OPENROUTER_API_KEY=(.+)$/m);
    return m ? m[1].trim().replace(/^"|"$/g, '') : '';
  } catch { return ''; }
}
module.exports = { openrouterKey };
