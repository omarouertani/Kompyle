import type { CVData, CVLang } from "@/types/cv";
import {
  canadianLayout,
  defaultLayout,
  isCanadianTemplate,
} from "./cv-layout";
import { getTemplateDef } from "./cv-templates";

/**
 * Données d'exemple (« mock ») injectées dans CHAQUE nouveau profil pour que les
 * templates ne s'affichent jamais vides. Ce sont des exemples génériques inventés
 * (personne fictive) : l'utilisateur les remplace champ par champ par ses vraies
 * données — chaque champ rempli fait disparaître l'exemple correspondant.
 *
 * Volontairement réaliste mais clairement fictif (« Jane Doe », domaines example.com,
 * numéro réservé à la fiction, entreprises et écoles inventées), pour servir de
 * guide de remplissage sans ressembler à de vraies coordonnées.
 */
export function mockCV(template = "default", lang: CVLang = "fr"): CVData {
  const content = lang === "en" ? MOCK_EN : MOCK_FR;
  return {
    ...structuredClone(content),
    layout: isCanadianTemplate(template)
      ? canadianLayout()
      : {
          ...defaultLayout(),
          theme: { ...getTemplateDef(template).theme },
        },
  };
}

/** Coordonnées fictives communes aux deux langues (servent aussi à reconnaître
 *  le CV d'exemple, cf. isSampleCV). */
const MOCK_CONTACT = {
  name: "Jane Doe",
  techLine: "React · Node.js · TypeScript · PostgreSQL · AWS",
  email: "jane.doe@example.com",
  phone: "+33 6 39 98 00 00",
  linkedin: "linkedin.com/in/janedoe-example",
  portfolio: "janedoe.example.com",
};

const MOCK_FR: Omit<CVData, "layout"> = {
    language: "fr",
    personalInfo: {
      ...MOCK_CONTACT,
      role: "Développeuse Full-Stack",
      location: "Villexemple, France",
      summary:
        "Développeuse full-stack avec 5 ans d'expérience dans la conception d'applications web performantes et accessibles. Passionnée par le code propre, l'expérience utilisateur et les architectures évolutives. À l'aise aussi bien sur le front (React/Next.js) que sur le back (Node.js, PostgreSQL) et le cloud.",
      certifications: "AWS Certified Developer – Associate, Scrum Master (PSM I)",
      interests: "Randonnée · Photographie · Open source · Cuisine",
    },
    skills: [
      { category: "Frontend", items: "React, Next.js, TypeScript, Tailwind CSS, Redux" },
      { category: "Backend", items: "Node.js, Express, PostgreSQL, Prisma, REST, GraphQL" },
      { category: "Outils & Cloud", items: "Git, Docker, AWS, CI/CD, Jest, Figma" },
    ],
    spokenLanguages: ["Français (Natif)", "Anglais (Courant – C1)", "Espagnol (Intermédiaire – B1)"],
    education: [
      {
        degree: "Master Ingénierie Informatique",
        institution: "Université Exemple",
        date: "2016 — 2018",
      },
      {
        degree: "Licence Informatique",
        institution: "Institut Fictif des Sciences",
        date: "2013 — 2016",
      },
    ],
    experiences: [
      {
        title: "Développeuse Full-Stack Senior",
        org: "Exemple SaaS Corp",
        date: "2021 — Présent",
        bullets: [
          "Conçu et déployé une plateforme SaaS servant plus de 20 000 utilisateurs actifs mensuels.",
          "Réduit le temps de chargement de 40 % en optimisant le rendu côté serveur et les requêtes SQL.",
          "Encadré une équipe de 3 développeurs juniors et instauré les revues de code systématiques.",
        ],
      },
      {
        title: "Développeuse Web",
        org: "Agence Fictive Web",
        date: "2018 — 2021",
        bullets: [
          "Développé des interfaces React réutilisables pour une dizaine de clients e-commerce.",
          "Intégré des API de paiement (Stripe) et mis en place les tests automatisés (Jest, Cypress).",
          "Collaboré étroitement avec les designers pour garantir une accessibilité WCAG AA.",
        ],
      },
    ],
    projects: [
      {
        title: "Gestionnaire de tâches collaboratif",
        description:
          "Application web de gestion de tâches en équipe avec synchronisation en temps réel et notifications.",
        stack: "Next.js, TypeScript, PostgreSQL, WebSockets",
      },
    ],
};

const MOCK_EN: Omit<CVData, "layout"> = {
  language: "en",
  personalInfo: {
    ...MOCK_CONTACT,
    role: "Full-Stack Developer",
    location: "Sampletown, France",
    summary:
      "Full-stack developer with 5 years of experience building fast, accessible web applications. Passionate about clean code, user experience and scalable architectures. Equally comfortable on the front end (React/Next.js), the back end (Node.js, PostgreSQL) and the cloud.",
    certifications: "AWS Certified Developer – Associate, Scrum Master (PSM I)",
    interests: "Hiking · Photography · Open source · Cooking",
  },
  skills: [
    { category: "Frontend", items: "React, Next.js, TypeScript, Tailwind CSS, Redux" },
    { category: "Backend", items: "Node.js, Express, PostgreSQL, Prisma, REST, GraphQL" },
    { category: "Tools & Cloud", items: "Git, Docker, AWS, CI/CD, Jest, Figma" },
  ],
  spokenLanguages: ["French (Native)", "English (Fluent – C1)", "Spanish (Intermediate – B1)"],
  education: [
    {
      degree: "Master's in Computer Engineering",
      institution: "Sample University",
      date: "2016 — 2018",
    },
    {
      degree: "Bachelor's in Computer Science",
      institution: "Fictional Institute of Science",
      date: "2013 — 2016",
    },
  ],
  experiences: [
    {
      title: "Senior Full-Stack Developer",
      org: "Sample SaaS Corp",
      date: "2021 — Present",
      bullets: [
        "Designed and shipped a SaaS platform serving more than 20,000 monthly active users.",
        "Cut load time by 40% by optimizing server-side rendering and SQL queries.",
        "Mentored a team of 3 junior developers and introduced systematic code reviews.",
      ],
    },
    {
      title: "Web Developer",
      org: "Fictional Web Agency",
      date: "2018 — 2021",
      bullets: [
        "Built reusable React interfaces for about ten e-commerce clients.",
        "Integrated payment APIs (Stripe) and set up automated testing (Jest, Cypress).",
        "Worked closely with designers to meet WCAG AA accessibility.",
      ],
    },
  ],
  projects: [
    {
      title: "Collaborative task manager",
      description: "Team task management web app with real-time sync and notifications.",
      stack: "Next.js, TypeScript, PostgreSQL, WebSockets",
    },
  ],
};
