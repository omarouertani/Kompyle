import type { CVData } from "@/types/cv";
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
export function mockCV(template = "default"): CVData {
  return {
    personalInfo: {
      name: "Jane Doe",
      role: "Développeuse Full-Stack",
      techLine: "React · Node.js · TypeScript · PostgreSQL · AWS",
      email: "jane.doe@example.com",
      phone: "+33 6 39 98 00 00",
      location: "Villexemple, France",
      linkedin: "linkedin.com/in/janedoe-example",
      portfolio: "janedoe.example.com",
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
    layout: isCanadianTemplate(template)
      ? canadianLayout()
      : {
          ...defaultLayout(),
          theme: { ...getTemplateDef(template).theme },
        },
  };
}
