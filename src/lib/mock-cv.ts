import type { CVData } from "@/types/cv";
import {
  canadianLayout,
  defaultLayout,
  isCanadianTemplate,
  isModernTemplate,
} from "./cv-layout";

/**
 * Données d'exemple (« mock ») injectées dans CHAQUE nouveau profil pour que les
 * templates ne s'affichent jamais vides. Ce sont des exemples génériques inventés
 * (personne fictive) : l'utilisateur les remplace champ par champ par ses vraies
 * données — chaque champ rempli fait disparaître l'exemple correspondant.
 *
 * Volontairement réaliste mais clairement fictif (« Camille Laurent »), pour
 * servir de guide de remplissage sans ressembler à de vraies coordonnées.
 */
export function mockCV(template = "default"): CVData {
  return {
    personalInfo: {
      name: "Camille Laurent",
      role: "Développeuse Full-Stack",
      techLine: "React · Node.js · TypeScript · PostgreSQL · AWS",
      email: "camille.laurent@exemple.com",
      phone: "+33 6 12 34 56 78",
      location: "Paris, France",
      linkedin: "linkedin.com/in/camille-laurent",
      portfolio: "camille-laurent.dev",
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
        institution: "Université de Paris-Saclay",
        date: "2016 — 2018",
      },
      {
        degree: "Licence Informatique",
        institution: "Université de Lyon",
        date: "2013 — 2016",
      },
    ],
    experiences: [
      {
        title: "Développeuse Full-Stack Senior",
        org: "TechNova",
        date: "2021 — Présent",
        bullets: [
          "Conçu et déployé une plateforme SaaS servant plus de 20 000 utilisateurs actifs mensuels.",
          "Réduit le temps de chargement de 40 % en optimisant le rendu côté serveur et les requêtes SQL.",
          "Encadré une équipe de 3 développeurs juniors et instauré les revues de code systématiques.",
        ],
      },
      {
        title: "Développeuse Web",
        org: "Studio Digital",
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
        title: "Kompyle — Générateur de CV IA",
        description:
          "Application web permettant de créer, adapter et optimiser des CV grâce à l'IA, avec un éditeur canvas en temps réel.",
        stack: "Next.js, TypeScript, PostgreSQL, OpenAI",
      },
    ],
    layout: isCanadianTemplate(template)
      ? canadianLayout()
      : {
          ...defaultLayout(),
          theme: isModernTemplate(template)
            ? { primaryColor: "#fbbf24", sidebarBg: "#f4f4f5" }
            : {},
        },
  };
}
