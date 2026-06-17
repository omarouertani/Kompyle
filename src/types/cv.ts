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
  photo?: string;          // Photo de profil (Base64 ou URL)
  birthDate?: string;      // Date de naissance
  certifications?: string; // Certifications
  interests?: string;      // Centres d'intérêt
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
  date?: string;
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
  | "education"
  | "certifications"
  | "interests";

// Une page = un <Page> PDF, avec deux colonnes pilotées par des IDs de section.
export interface LayoutPage {
  main: string[];
  sidebar: string[];
}

export type CVFontFamily =
  | "sans"
  | "serif"
  | "modern"
  | "mono"
  // Pack pro (cf. FONT_FAMILIES / pdf-fonts.ts / layout.tsx)
  | "lato"
  | "montserrat"
  | "poppins"
  | "opensans"
  | "sourcesans"
  | "merriweather"
  | "playfair"
  | "georgia";
export type SkillMode = "text" | "tags" | "bars";

export interface CVTheme {
  primaryColor?: string; // Couleur principale (titres, accents, puces)
  textColor?: string;    // Couleur du texte principal
  sidebarBg?: string;    // Couleur de fond de la barre latérale
  pageBg?: string;       // Couleur de fond de la page (blanc, ivoire...)
  fontFamily?: CVFontFamily; // Famille de police du CV
  skillMode?: SkillMode; // Rendu des compétences : texte, tags ou barres
  fontSize?: number;     // Taille du texte de base (pt)
  headingSize?: number;  // Taille des titres (pt)
  sectionMargin?: number;// Espacement entre les sections (pt)
  lineHeight?: number;   // Hauteur de ligne (interligne)
  /** Couleurs de marque épinglées par l'utilisateur (panneau « Identité visuelle »). */
  brandColors?: string[];
  /** Dernières couleurs utilisées (persistées pour survivre au rechargement). */
  recentColors?: string[];
}

export interface ElementPosition {
  x: number;
  y: number;
  w?: number;
  h?: number; // hauteur explicite (pt) — sinon auto selon le contenu
  page?: number; // index de page (0-based) en mode pagination auto
  fontScale?: number; // échelle de police (resize diagonal) — 1 par défaut
  locked?: boolean;   // bloc verrouillé : ni drag ni resize
  groupId?: string;   // identifiant de groupe : les blocs partageant un groupId se déplacent ensemble
}

export interface CVLayout {
  sidebarWidth?: number; // largeur de la colonne latérale, en points (défaut 165)
  pages: LayoutPage[];
  theme?: CVTheme;       // Thème de couleurs personnalisé
  absolutePositions?: Record<string, ElementPosition>; // Canva-style absolute coordinates
  useAbsolutePositioning?: boolean; // toggle to enable Canva absolute layout
  /** Renommage des sections built-in (id → titre affiché). Vide = libellé par défaut. */
  sectionTitles?: Record<string, string>;
  autoPaginated?: boolean; // les blocs sont répartis sur plusieurs pages via ElementPosition.page
}

/** Section libre créée par l'utilisateur (titre + texte).
 *  Référencée dans layout.pages via l'id `custom_<id>`. */
export interface CustomSection {
  id: string;
  title: string;
  content: string;
}

export interface CVData {
  personalInfo: PersonalInfo;
  skills: SkillGroup[];
  spokenLanguages: string[];
  education: Education[];
  experiences: Experience[];
  projects: Project[];
  customSections?: CustomSection[];
  layout?: CVLayout;
}

// ─── API Types ──────────────────────────────────────────────────────────────

// Providers supportés. OpenRouter = modèles gratuits (clé user). Google/OpenAI/
// Anthropic/Groq/Mistral = modèles appelés directement avec la clé du provider (BYOK).
export type AIProvider = "openrouter" | "google" | "openai" | "anthropic" | "groq" | "mistral";

export interface AdaptCVRequest {
  jobDescription: string;
  cvData: CVData;
  provider?: AIProvider;
  model?: string;
  /** Clé API du provider, saisie par l'utilisateur (BYOK). Jamais loggée. */
  apiKey?: string;
}

export interface AdaptCVResponse {
  adaptedCV: CVData;
  provider: AIProvider;
  /** Modèle OpenRouter qui a effectivement répondu (après fallback éventuel). */
  model: string;
}

export interface AdaptCVErrorResponse {
  error: string;
  details?: string;
}

// ─── Refinement (discussion continue sur le même document) ─────────────────

export interface RefineCVRequest {
  instruction: string;
  cvData: CVData;
  /** Offre d'emploi d'origine — contexte optionnel pour garder l'alignement. */
  jobDescription?: string;
  provider?: AIProvider;
  model?: string;
  /** Clé API du provider, saisie par l'utilisateur (BYOK). Jamais loggée. */
  apiKey?: string;
}

export interface RefineCVResponse {
  refinedCV: CVData;
  provider: AIProvider;
  model: string;
}

export interface RefineCoverLetterRequest {
  instruction: string;
  coverLetter: CoverLetterData;
  jobDescription?: string;
  provider?: AIProvider;
  model?: string;
  /** Clé API du provider, saisie par l'utilisateur (BYOK). Jamais loggée. */
  apiKey?: string;
}

export interface RefineCoverLetterResponse {
  coverLetter: CoverLetterData;
  provider: AIProvider;
  model: string;
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
  model?: string;
  /** Clé API du provider, saisie par l'utilisateur (BYOK). Jamais loggée. */
  apiKey?: string;
}

export interface GenerateCoverLetterResponse {
  coverLetter: CoverLetterData;
  provider: AIProvider;
  model: string;
}

// ─── ATS Checker ────────────────────────────────────────────────────────────

export type ATSSectionStatus = "good" | "warning" | "missing";

export interface ATSSectionFeedback {
  section: string;
  status: ATSSectionStatus;
  feedback: string;
}

export interface ATSSubScores {
  keywords: number;
  skills: number;
  experience: number;
  formatting: number;
}

/** Mot-clé trouvé dans le CV, accompagné de la preuve de son emplacement. */
export interface ATSMatchedKeyword {
  term: string;
  /** Emplacement exact où le terme a été trouvé (ex: "skills.items", "projects.stack"). */
  foundInSection: string;
}

export interface ATSReport {
  overallScore: number;
  scoreLabel: string;
  summary: string;
  subScores: ATSSubScores;
  matchedKeywords: ATSMatchedKeyword[];
  missingKeywords: string[];
  sectionFeedback: ATSSectionFeedback[];
  strengths: string[];
  recommendations: string[];
}

export interface ATSCheckRequest {
  jobDescription: string;
  cvData: CVData;
  provider?: AIProvider;
  model?: string;
  /** Clé API du provider, saisie par l'utilisateur (BYOK). Jamais loggée. */
  apiKey?: string;
}

export interface ATSCheckResponse {
  report: ATSReport;
  provider: AIProvider;
  model: string;
}
