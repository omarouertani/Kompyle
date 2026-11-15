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

const SUBTITLES = {
  overview: 'Kompyle: a free, open-source CV editor',
  paste: 'Paste the job offer',
  adapt: 'AI tailors your CV to the job',
  letter: 'Get a matching cover letter',
  ats: 'Check your ATS score before you apply',
  finish: 'Pick a theme. Export to PDF or Word.',
};

const INTRO = {
  seconds: 3.2,
  line1: 'One CV for every job?',
  line2: "That's why nobody calls back.",
};

const OUTRO = {
  seconds: 4.2,
  wordmark: 'Kompyle',
  points: ['Free', 'Open source', 'Runs anywhere with Docker'],
  command: 'docker compose up',
  url: 'github.com/omarouertani/Kompyle',
};

/** Output formats: canvas size, app card rectangle, subtitle baseline. */
const FORMATS = {
  '16x9': { w: 1920, h: 1080, card: { x: 150, y: 44, w: 1620, h: 911 }, subY: 1012, follow: 0.0, title: 96, sub: 40 },
  '1x1': { w: 1080, h: 1080, card: { x: 40, y: 40, w: 1000, h: 820 }, subY: 958, follow: 0.55, title: 76, sub: 38 },
  '9x16': { w: 1080, h: 1920, card: { x: 40, y: 300, w: 1000, h: 1180 }, subY: 1600, follow: 0.6, title: 84, sub: 44 },
};

module.exports = { COLORS, SUBTITLES, INTRO, OUTRO, FORMATS };
