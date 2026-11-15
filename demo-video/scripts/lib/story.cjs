'use strict';
/** Words and design tokens of the video (colours = Kompyle's dark theme). */

const COLORS = {
  ground: '#1b1b1b',     // --muted (dark)
  ground2: '#262626',    // --background (dark)
  ink: '#faf8f1',        // --card-foreground (dark)
  inkSoft: '#b7b5a6',    // --muted-foreground (dark)
  accent: '#d87757',     // --primary (dark)
  border: '#3e3e38',     // --border (dark)
};

/** Caption shown over the app during each recorded scene (see record.cjs scene marks). */
const SUBTITLES = {
  overview: 'Kompyle: a free, open-source CV editor',
  keys: '4 of the 6 AI providers are free',
  paste: 'Paste the job offer',
  adapt: 'The AI tailors your CV to it',
  letter: 'A cover letter for the same offer',
  ats: 'Your ATS score and the missing keywords',
  edit: 'Templates, colours and a full toolbar, on the page',
  finish: 'Export to PDF or Word',
};

/**
 * Chapter cards, shown before the scene of the same name. They speak to the
 * viewer: a job seeker, or someone who knows one. "\n" = line break.
 */
const CARDS = {
  keys: { kicker: 'Step 1 · Set up', title: 'Plug in a free\nAI key.', sub: 'Most AI models in Kompyle are free.\nAdd your key once. It stays in your browser.' },
  paste: { kicker: 'Step 2 · Tailor', title: 'Found a job\nyou want?', sub: 'Paste the offer.\nThe AI rewrites your CV to match it.' },
  letter: { kicker: 'Step 3 · Write', title: 'Need a cover\nletter too?', sub: 'One click.\nWritten for the same offer.' },
  ats: { kicker: 'Step 4 · Check', title: 'Will a robot read\nyour CV first?', sub: 'Many companies filter CVs with an ATS.\nSee your score before you apply.' },
  edit: { kicker: 'Step 5 · Design', title: 'Make it\nlook like you.', sub: 'Switch templates, change colours,\nedit any word right on the page.' },
  finish: { kicker: 'Step 6 · Send', title: 'Ready to apply?', sub: 'Export to PDF or Word.', seconds: 2.3 },
};
const CARD_SECONDS = 2.8;

/** Always on screen during the app scenes. */
const BADGE = 'Free & open source';

const INTRO = {
  seconds: 3.4,
  line1: 'Sending the same CV\nto every job?',
  line2: "That's why nobody calls back.",
};

const OUTRO = {
  seconds: 6.0,
  wordmark: 'Kompyle',
  points: ['Free', 'Open source', 'Runs anywhere with Docker'],
  command: 'docker compose up',
  url: 'github.com/omarouertani/Kompyle',
  share: 'Know someone who is job hunting? Send them this.',
};

/** Transitions (gl-transitions, MIT): into a card / the outro, and from a card into the app. */
const TRANSITIONS = {
  seconds: 0.75,
  toCard: { name: 'directionalwarp', params: { direction: [-1, 0] } },
  toApp: { name: 'SimpleZoom', params: { zoom_quickness: 0.7 } },
};

/** Output formats: canvas size, app card rectangle, subtitle baseline, chapter-card type sizes. */
const FORMATS = {
  '16x9': { w: 1920, h: 1080, card: { x: 150, y: 44, w: 1620, h: 911 }, subY: 1012, follow: 0.0, sub: 40, left: 150, kick: 28, head: 112, body: 44 },
  '1x1': { w: 1080, h: 1080, card: { x: 40, y: 40, w: 1000, h: 820 }, subY: 958, follow: 0.55, sub: 38, left: 84, kick: 28, head: 92, body: 40 },
  '9x16': { w: 1080, h: 1920, card: { x: 40, y: 300, w: 1000, h: 1180 }, subY: 1600, follow: 0.6, sub: 44, left: 84, kick: 32, head: 100, body: 46 },
};

module.exports = { COLORS, SUBTITLES, CARDS, CARD_SECONDS, BADGE, INTRO, OUTRO, TRANSITIONS, FORMATS };
