'use strict';
/**
 * Scripted AI answers for the recording (DEMO_AI=mock, the default).
 *
 * Why: the demo must not depend on a free model being up, nor show an API key.
 * Playwright intercepts the three AI routes and answers with content shaped
 * exactly like the real routes (same JSON, same immutable-field rules: name,
 * contacts, education, job titles, companies and dates are never changed).
 * Everything else on screen is the real app. Use DEMO_AI=live to call the real
 * routes with the key from .env.local instead.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SUMMARY =
  'Full-stack engineer with 5 years of experience building fast, accessible web products with React, Next.js, TypeScript and Node.js. ' +
  'Experienced with payment integrations (Stripe), PostgreSQL and AWS CI/CD pipelines. Motivated by fintech products that help small businesses get paid.';

const EXP_BULLETS = [
  [
    'Built customer-facing features in React, Next.js and TypeScript for a SaaS platform with 20,000+ monthly active users.',
    'Designed REST and GraphQL APIs in Node.js with PostgreSQL; cut load time by 40% through SQL and server-side rendering optimizations.',
    'Led code reviews for a team of 3 junior developers and shipped to AWS through a CI/CD pipeline.',
  ],
  [
    'Developed reusable React interfaces in TypeScript for about ten e-commerce clients.',
    'Integrated Stripe payment APIs and set up automated testing with Jest and Cypress.',
    'Worked closely with product designers to deliver accessible interfaces (WCAG AA).',
  ],
];

const SKILLS = [
  'React, Next.js, TypeScript, Tailwind CSS, Redux, accessibility (WCAG)',
  'Node.js, Express, PostgreSQL, Prisma, REST, GraphQL, payment APIs (Stripe)',
  'Git, Docker, AWS, CI/CD, Jest, Cypress, Figma',
];

function adapt(cv) {
  const out = JSON.parse(JSON.stringify(cv));
  out.personalInfo.role = 'Full-Stack Engineer · React & Node.js';
  out.personalInfo.techLine = 'React · Next.js · TypeScript · Node.js · PostgreSQL · AWS';
  out.personalInfo.summary = SUMMARY;
  out.experiences = out.experiences.map((e, i) => (EXP_BULLETS[i] ? { ...e, bullets: EXP_BULLETS[i] } : e));
  out.skills = out.skills.map((g, i) => (SKILLS[i] ? { ...g, items: SKILLS[i] } : g));
  out.projects = (out.projects || []).map((p, i) =>
    i === 0 ? { ...p, description: 'Team task manager with real-time sync, notifications and end-to-end tests; built with Next.js, TypeScript and PostgreSQL.' } : p,
  );
  if (out.layout) {
    delete out.layout.absolutePositions;
    delete out.layout.useAbsolutePositioning;
  }
  out.language = 'en';
  return out;
}

function atsReport() {
  return {
    overallScore: 87,
    scoreLabel: 'Strong match',
    summary: 'Your CV matches most of the role: React, TypeScript, Node.js and PostgreSQL are clearly backed by experience. Add your Playwright experience and a word on security to close the gap.',
    subScores: { keywords: 84, skills: 90, experience: 88, formatting: 92 },
    matchedKeywords: [
      { term: 'React', foundInSection: 'skills.items' },
      { term: 'Next.js', foundInSection: 'skills.items' },
      { term: 'TypeScript', foundInSection: 'skills.items' },
      { term: 'Node.js', foundInSection: 'skills.items' },
      { term: 'PostgreSQL', foundInSection: 'skills.items' },
      { term: 'GraphQL', foundInSection: 'skills.items' },
      { term: 'Docker', foundInSection: 'skills.items' },
      { term: 'AWS', foundInSection: 'skills.items' },
      { term: 'CI/CD', foundInSection: 'skills.items' },
      { term: 'Jest', foundInSection: 'skills.items' },
      { term: 'WCAG', foundInSection: 'experiences.bullets' },
      { term: 'Stripe', foundInSection: 'experiences.bullets' },
    ],
    missingKeywords: ['Playwright', 'fintech', 'security'],
    sectionFeedback: [
      { section: 'Summary', status: 'good', feedback: 'Targets the role and names the core stack.' },
      { section: 'Experience', status: 'good', feedback: 'Bullets start with action verbs and include measurable results.' },
      { section: 'Skills', status: 'good', feedback: 'Grouped clearly and aligned with the job posting.' },
      { section: 'Projects', status: 'warning', feedback: 'Mention the testing tools you used.' },
    ],
    strengths: ['Measurable impact (20,000+ users, 40% faster)', 'Payment integration experience (Stripe)', 'Accessibility (WCAG AA)'],
    recommendations: ['Add Playwright to your testing skills if you have used it.', 'Mention security best practices from your payment work.'],
  };
}

function coverLetter() {
  return {
    recipientName: 'Hiring Manager',
    recipientCompany: 'Northwind Pay',
    recipientAddress: 'Lyon, France',
    date: 'November 15, 2026',
    subject: 'Application for the Junior Full-Stack Engineer position',
    salutation: 'Dear Hiring Manager,',
    paragraphs: [
      'I am applying for the Full-Stack Engineer position at Northwind Pay. Building tools that help small businesses get paid is exactly the kind of product I want to work on.',
      'Over the past 5 years I have built customer-facing features with React, Next.js and TypeScript, and designed Node.js APIs on PostgreSQL. At Sample SaaS Corp, I cut load time by 40% for a platform with 20,000+ monthly users.',
      'I have also integrated Stripe payments, written automated tests with Jest and Cypress, and shipped to AWS through CI/CD. I care about accessible interfaces and enjoy working closely with designers.',
      'I would be glad to discuss how I can help your product team. Thank you for your time and consideration.',
    ],
    signOff: 'Best regards,',
  };
}

/** Installs the routes. `delay` = fake thinking time (ms), trimmed in the edit. */
async function installAiMock(page, { delay = 3500 } = {}) {
  await page.route('**/api/adapt-cv', async (route) => {
    const body = route.request().postDataJSON();
    await sleep(delay);
    await route.fulfill({ json: { adaptedCV: adapt(body.cvData), provider: 'openrouter', model: body.model || 'openrouter/free' } });
  });
  await page.route('**/api/ats-check', async (route) => {
    const body = route.request().postDataJSON();
    await sleep(delay * 0.8);
    await route.fulfill({ json: { report: atsReport(), provider: 'openrouter', model: body.model || 'openrouter/free' } });
  });
  await page.route('**/api/generate-cover-letter', async (route) => {
    const body = route.request().postDataJSON();
    await sleep(delay);
    await route.fulfill({ json: { coverLetter: coverLetter(), provider: 'openrouter', model: body.model || 'openrouter/free' } });
  });
}

module.exports = { installAiMock };
