// ─── CV Data Types ──────────────────────────────────────────────────────────
// Matches the exact structure of cv_data.json and the HTML CV layout.
// Any change here must be reflected in cv_data.json and the system prompt.

export interface PersonalInfo {
  name: string;
  role: string;
  techLine: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio?: string;
  summary: string;
}

export interface SkillGroup {
  id?: string;
  category: string;
  items: string;
}

export interface Experience {
  id?: string;
  forcePageBreak?: boolean;
  customMarginBottom?: number;
  title: string;
  org: string;
  date: string;
  bullets: string[];
}

export interface Project {
  id?: string;
  forcePageBreak?: boolean;
  customMarginBottom?: number;
  title: string;
  description: string;
  stack?: string;
}

export interface Education {
  id?: string;
  forcePageBreak?: boolean;
  customMarginBottom?: number;
  degree: string;
  institution: string;
}

// ─── Layout (sections & pages, modèle inspiré de Reactive Resume) ────────────
// Identifiants des sections "built-in". (Le header nom/rôle/techLine n'est pas
// une section : il est rendu en haut de la 1re page.)
export type SectionId =
  | "summary"
  | "experience"
  | "projects"
  | "contact"
  | "skills"
  | "languages"
  | "education";

// Une page = un <Page> PDF, avec deux colonnes pilotées par des IDs de section.
export interface LayoutPage {
  main: string[];
  sidebar: string[];
}

export interface CVLayout {
  sidebarWidth?: number; // largeur de la colonne latérale, en points (défaut 165)
  pages: LayoutPage[];
}

export interface CVData {
  personalInfo: PersonalInfo;
  skills: SkillGroup[];
  spokenLanguages: string[];
  education: Education[];
  experiences: Experience[];
  projects: Project[];
  layout?: CVLayout;
}

// ─── API Types ──────────────────────────────────────────────────────────────

export type AIProvider = "gemini" | "groq";

export interface AdaptCVRequest {
  jobDescription: string;
  cvData: CVData;
  provider?: AIProvider;
}

export interface AdaptCVResponse {
  adaptedCV: CVData;
  provider: AIProvider;
}

export interface AdaptCVErrorResponse {
  error: string;
  details?: string;
}

// ─── Cover Letter Types ─────────────────────────────────────────────────────

export interface CoverLetterData {
  recipientName: string; // e.g., "Hiring Manager" or actual name
  recipientCompany: string; // e.g., "Tech Corp"
  recipientAddress: string; // Optional Address
  date: string;
  subject: string;
  salutation: string; // e.g., "Dear Hiring Manager,"
  paragraphs: string[];
  signOff: string; // e.g., "Sincerely,"
}

export interface GenerateCoverLetterRequest {
  jobDescription: string;
  cvData: CVData;
  provider?: AIProvider;
}

export interface GenerateCoverLetterResponse {
  coverLetter: CoverLetterData;
  provider: AIProvider;
}
