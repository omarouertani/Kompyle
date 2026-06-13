<div align="center">
  <a href="#">
    <img src="public/images/Kompyle1.png" alt="Kompyle Banner" width="100%" style="border-radius: 8px; box-shadow: 0 4px 30px rgba(0,0,0,0.1);" />
  </a>

  <h1>🚀 Kompyle</h1>

  <p><b>Kompyle</b> est un éditeur de CV interactif et adaptateur IA open-source qui permet de personnaliser, mettre en page et exporter vos candidatures en temps réel, avec un canvas style Canva et un rendu PDF WYSIWYG.</p>

  <p>
    <a href="#-démarrage-rapide-installation-locale"><b>Démarrer l'application</b></a>
    ·
    <a href="#️-comment-fonctionne-lapplication-"><b>En savoir plus</b></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16.2.7-black?style=flat-square&logo=next.js" alt="Next.js Version">
    <img src="https://img.shields.io/badge/React-19.2.4-blue?style=flat-square&logo=react" alt="React Version">
    <img src="https://img.shields.io/badge/Tailwind-v4.0-38bdf8?style=flat-square&logo=tailwind-css" alt="Tailwind CSS">
    <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL">
    <img src="https://img.shields.io/badge/Google--Gemini-Active-4285F4?style=flat-square&logo=google-gemini" alt="Gemini Integration" />
    <img src="https://img.shields.io/badge/Groq--Llama-Active-f55036?style=flat-square" alt="Groq Llama Integration" />
    <img src="https://img.shields.io/badge/Mistral--AI-Active-ff6000?style=flat-square" alt="Mistral AI Integration" />
    <img src="https://img.shields.io/badge/i18n-FR%20%7C%20EN-green?style=flat-square" alt="Internationalization" />
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License" />
  </p>
</div>

---

**Kompyle** rend la personnalisation des candidatures extrêmement simple. Collez la description du poste visé, laissez l'IA reformuler vos expériences, affinez le résultat par instructions en langage naturel, ajustez visuellement la mise en page sur un canvas interactif style Canva, puis exportez le tout instantanément en PDF haute définition — identique au pixel près avec le canvas.

Construit sur des principes de rigueur et d'absence totale d'hallucinations, Kompyle sépare la mise en page (layout) de la couche de données pour offrir un contrôle absolu à l'utilisateur, tout en s'appuyant sur des schémas de validation Zod stricts et un mécanisme d'auto-correction.

---

## 📖 Table des Matières

1. [✨ Fonctionnalités](#-fonctionnalités)
2. [⚙️ Comment fonctionne l'application ?](#️-comment-fonctionne-lapplication-)
3. [🛠️ Stack Technique](#️-stack-technique)
4. [📁 Structure du Projet](#-structure-du-projet)
5. [🔑 Configuration des APIs & Environnement](#-configuration-des-apis--environnement)
6. [💿 Démarrage Rapide (Installation Locale)](#-démarrage-rapide-installation-locale)
7. [🐳 Déploiement avec Docker](#-déploiement-avec-docker)
8. [📄 Licence](#-licence)

---

## ✨ Fonctionnalités

### Adaptation et Raffinement IA

- **Reformulation Intelligente** : Réécriture du résumé, réorganisation des compétences et reformulation ciblée des accomplissements d'expérience en fonction du poste visé.
- **Raffinement par instruction** : Après adaptation, affinez le CV ou la lettre par simples instructions en langage naturel (ex : "raccourcis le second bullet de la première expérience") — l'IA applique chirurgicalement sans toucher au reste.
- **Générateur de Lettre de Motivation** : Rédaction en un clic d'une lettre de motivation sur-mesure de 4 paragraphes (+ raffinement post-génération par instruction).
- **Sélection du modèle IA** : Choisissez librement le fournisseur et le modèle à utiliser pour chaque opération :
  - **Google Gemini** : Gemini 2.5 Flash _(défaut)_, Gemini 2.5 Pro
  - **Groq** : Llama 3.3 70B _(défaut)_, Llama 3 70B, Mixtral 8x7B
  - **Mistral AI** : Mistral Large _(défaut)_, Mistral Small, Ministral 8B
- **Fallback automatique** : Si le modèle principal échoue, l'orchestrateur tente les suivants sans intervention.
- **Zod Schema & Self-Healing** : Validation stricte des données générées par l'IA ; en cas de JSON non conforme, le serveur extrait les erreurs Zod et demande un correctif ciblé au modèle.
- **Anti-Hallucination** : Les coordonnées réelles, établissements, entreprises et dates sont réinjectées de force sur la réponse IA — elle ne peut jamais les modifier.
- **Rate Limiting** : 10 requêtes par minute et par IP pour protéger les quotas API.

### Canvas Interactif (style Canva)

- **Positionnement absolu** : Chaque bloc (nom, rôle, sections, photo…) est déplaçable librement sur la page avec des coordonnées persistées — ce que vous voyez sur le canvas est exactement ce qui sera dans le PDF.
- **Multi-sélection par lasso** : Tracez un rectangle de sélection pour capturer plusieurs blocs d'un geste.
- **Barre d'alignement flottante** : Alignez ou distribuez uniformément les blocs sélectionnés (gauche, centre, droite, haut, milieu, bas, distribution horizontale/verticale).
- **Groupement** : Regroupez des blocs pour les déplacer ensemble ; dégroupez à tout moment.
- **Undo / Redo** : Historique complet des modifications (Ctrl+Z / Ctrl+Y).
- **Zoom** : De 30 % à 250 %, avec bouton "ajuster à la fenêtre".
- **Panoramique (Space-Pan)** : Maintenez Espace et faites glisser pour naviguer sur le canvas.
- **Guides d'accrochage (Snap)** : Les blocs s'alignent automatiquement sur les bords et centres des autres blocs lors du déplacement.
- **Redimensionnement diagonal** : Redimensionnez un bloc en tirant son coin ; la police s'adapte proportionnellement (`fontScale`).
- **Verrouillage de bloc** : Verrouillez un bloc pour le protéger de tout déplacement ou redimensionnement accidentel.
- **Édition directe** : Double-cliquez sur n'importe quel texte pour le corriger sans quitter le canvas.
- **Menu contextuel** : Clic droit sur un bloc pour accéder aux actions rapides.
- **Fond de canvas** : Trois modes — neutre, points, grille.
- **Raccourcis clavier** : Suppr pour supprimer, Échap pour désélectionner, Ctrl+A pour tout sélectionner, etc.

### Gestion des Pages

- **Pagination automatique** : Les blocs qui dépassent la hauteur A4 sont automatiquement répartis sur la page suivante.
- **Ajout / Suppression de pages** : Gérez vos pages CV multi-pages manuellement via la barre de navigation du canvas.
- **Auto-ajustement ("Réaligner")** : Le bouton Réaligner mesure les hauteurs réelles et réduit proportionnellement la police, les titres et les marges pour tout faire tenir sur une page A4 — avec repli sur une deuxième page si la densité est trop élevée.

### Thème & Mise en page

- **Panneau de thème** : Personnalisez en temps réel :
  - 6 **presets** de couleurs prêts à l'emploi (Ambre Doré, Bleu Corporate, Vert Émeraude, Rouge Rubis, Violet Indigo, Sombre Minimal)
  - **Couleur d'accent**, couleur de texte, fond de la barre latérale, fond de page
  - **Police** : Sans (Carlito), Serif (Georgia), Modern (IBM Plex Sans Variable), Mono (Courier New)
  - **Mode compétences** : texte libre, tags, ou barres de progression
  - Curseurs de taille de police, taille des titres, marge entre sections, interligne
- **Gestionnaire de layout** : Réorganisez les sections par glisser-déposer entre colonne principale et barre latérale, affichez/masquez des sections, renommez-les, ajustez la largeur de la barre latérale.
- **Sections personnalisées** : Ajoutez des sections libres (titre + contenu) au-delà des sections prédéfinies.

### Templates

- **Classique** (`default`) : Deux colonnes — barre latérale (contact, compétences, langues, formations) + colonne principale (résumé, expériences, projets). Photo de profil optionnelle.
- **Moderne** (`modern`) : Deux colonnes avec accents ambrés et photo de profil mise en avant.
- **Canadien** (`canadian`) : **Nouveau** — colonne unique pleine largeur, sans photo, sans informations personnelles (âge, date de naissance…). En-tête minimaliste avec ligne de coordonnées (Téléphone · Email · LinkedIn · Ville/Province). Ordre ATS-optimisé : Résumé professionnel → Compétences clés → Expériences professionnelles → Éducation. Idéal pour le marché canadien et les systèmes de tri automatisé (ATS).

### Gestion des Profils & Versions

- **Multi-profils** : Créez, renommez et supprimez plusieurs profils de CV stockés en base PostgreSQL.
- **Versions d'adaptation** : Chaque adaptation IA crée une nouvelle version liée au profil parent — naviguez et comparez vos versions précédentes.
- **Suppression de version** : Supprimez une version spécifique sans affecter le profil original.
- **Fallback sans base** : Si la base de données est indisponible, l'application démarre avec un CV vierge éditable.

### Visualisation & Export

- **Canvas = PDF (WYSIWYG)** : Le PDF est généré serveur-side à partir des positions absolues du canvas — ce que vous voyez est exactement ce qui sera exporté.
- **Rendu serveur-side** : L'API `/api/render-pdf` génère le PDF en arrière-plan (debounce 600 ms) sans bloquer le thread UI.
- **Diff Visuel côte-à-côte** : Comparez le CV original et la version adaptée avec mise en valeur des différences en vert (ajouts) et rouge (suppressions).
- **Export PDF Haute Définition** : Rendu vectoriel via `@react-pdf/renderer` avec nommage professionnel de fichier.

### Interface & Expérience

- **Multi-langues** : Interface disponible en Français et Anglais via `next-intl` avec routage `/fr` et `/en`.
- **Thème clair / sombre** : Bascule dark mode via `next-themes`.
- **Sidebar rétractable** : Masquez le panneau gauche pour maximiser l'espace de prévisualisation.
- **Squelette de chargement IA animé** : Overlay shimmer pendant la génération — aucune étape simulée, la durée correspond exactement au temps de réponse réel.

---

## ⚙️ Comment fonctionne l'application ?

Kompyle utilise une architecture robuste en couches :

```mermaid
graph LR
    A[Saisie offre & profil] --> B[Appel API Next.js]
    B --> C[Nettoyage des données & prompt strict]
    C --> D[Génération IA : Gemini / Groq / Mistral]
    D --> E{Validation Zod}
    E -- Échec --> F[Prompt Correctif / Auto-Réparation]
    F --> D
    E -- Succès --> G[Protection anti-hallucination]
    G --> H[Sauvegarde profil PostgreSQL]
    H --> I[Rendu PDF serveur + Canvas WYSIWYG]
    I --> J[Diff visuel côte-à-côte]
    J --> K[Raffinement par instruction]
    K --> D
```

1. **Extraction JSON** : L'IA reçoit uniquement la description textuelle du CV et l'offre d'emploi. Les données graphiques et les positions du canvas sont exclues du prompt pour économiser les tokens.
2. **Auto-Correction (Self-Healing)** : Si la structure JSON est altérée par l'IA, le serveur extrait les erreurs Zod et demande un correctif ciblé — sans relancer une génération complète.
3. **Protection des Données (Immutabilité)** : Toutes les données clés réelles (emails, téléphones, universités, entreprises, dates) sont fusionnées de force sur la réponse IA.
4. **Raffinement chirurgical** : Les instructions de raffinement (`/api/refine-cv`) ciblent uniquement les champs mentionnés — tout le reste est copié caractère par caractère depuis l'entrée.
5. **Canvas WYSIWYG** : Les positions absolues du canvas sont passées directement au moteur PDF — les coordonnées, espacements et pages correspondent exactement.
6. **Calcul de Différences** : L'éditeur affiche en surbrillance verte les ajouts et en rouge les suppressions par rapport au CV original.

---

## 🛠️ Stack Technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16.2.7 (App Router, routing multilingue, builds `standalone`) |
| UI | React 19.2.4 (React Compiler activé) |
| Styling | Tailwind CSS v4.0 (variables CSS natives, PostCSS) |
| Composants | shadcn/ui + Radix UI primitives |
| Validation | Zod v4 (validation de schéma + synchronisation TypeScript) |
| PDF Engine | `@react-pdf/renderer` v4 (rendu asynchrone et vectoriel) |
| Drag & Drop | `@dnd-kit/core` & `@dnd-kit/sortable` |
| Diff Engine | `diff` (calculateur de différences textuelles) |
| i18n | `next-intl` (Français / Anglais) |
| Thème | `next-themes` (dark / light mode) |
| Base de données | PostgreSQL 16 (profils & versions de CV, via `pg`) |
| IA Gemini | `@google/genai` SDK |
| IA Groq | `groq-sdk` |
| IA Mistral | API REST native (pas de SDK) |
| Icons | `lucide-react` + `@phosphor-icons/react` |
| IDs | `uuid` v14 |

---

## 📁 Structure du Projet

```text
├── messages/                  # Traductions (en.json, fr.json)
├── public/                    # Assets statiques et polices personnalisées
│   └── images/                # Captures d'écran (Kompyle1.png, kompyle2.png)
├── scripts/
│   ├── init.sql               # Schéma PostgreSQL (table cv_profiles + index GIN)
│   └── seed_profiles.sql      # Données de démonstration
├── src/
│   ├── app/
│   │   ├── [locale]/          # Pages internationalisées (/, layout)
│   │   └── api/
│   │       ├── adapt-cv/      # POST — adaptation IA du CV
│   │       ├── generate-cover-letter/ # POST — génération de lettre
│   │       ├── refine-cv/     # POST — raffinement chirurgical du CV
│   │       ├── refine-cover-letter/  # POST — raffinement de la lettre
│   │       ├── render-pdf/    # POST — rendu PDF serveur-side
│   │       └── cv-profiles/   # GET/POST + [id] GET/PATCH/DELETE — profils & versions
│   ├── components/
│   │   ├── cv/
│   │   │   ├── canvas/        # Hooks canvas (interactions, undo/redo, zoom, snap, grouping…)
│   │   │   ├── template/      # Renderers partagés (classic, modern, shared styles)
│   │   │   ├── CVInteractiveCanvas.tsx  # Canvas principal style Canva
│   │   │   ├── CVPreview.tsx  # Prévisualisation + sélection template + versions
│   │   │   ├── CVBuilder.tsx  # Éditeur de données structuré (formulaire)
│   │   │   ├── CVTemplate.tsx # Moteur de rendu commun (classique + canadien)
│   │   │   ├── CVTemplateModern.tsx   # Template Moderne
│   │   │   ├── CVTemplateCanadian.tsx # Template Canadien (ATS)
│   │   │   ├── LayoutManager.tsx      # Gestionnaire de sections drag-and-drop
│   │   │   ├── CoverLetterBuilder.tsx # Éditeur de lettre de motivation
│   │   │   ├── CoverLetterPreview.tsx # Prévisualisation de lettre
│   │   │   ├── AIAdaptOverlay.tsx     # Overlay skeleton de chargement IA
│   │   │   └── status-banner.tsx      # Bannière de statut des opérations IA
│   │   ├── pdf-primitives/    # Primitives de rendu PDF (@react-pdf/renderer)
│   │   └── ui/                # Composants shadcn/ui (Button, Input, Select, Tabs…)
│   ├── hooks/
│   │   ├── use-profile-manager.ts     # CRUD profils, versions, fallback CV vierge
│   │   ├── use-ai-provider-config.ts  # Sélection fournisseur + modèle IA
│   │   └── use-ai-submission.ts       # Orchestration des soumissions IA
│   ├── lib/
│   │   ├── cv-layout.ts       # Layouts (default, modern, canadian), migration, dedup
│   │   ├── ai-orchestrator.ts # Fallback chain entre fournisseurs
│   │   ├── ai-providers.ts    # Appels Gemini / Groq / Mistral
│   │   ├── rate-limiter.ts    # 10 req/min par IP
│   │   └── db.ts              # Pool PostgreSQL
│   ├── schemas/               # Schémas Zod (resumeSchema, coverLetterSchema)
│   ├── types/                 # Types TypeScript (CVData, CVTheme, CVLayout…)
│   └── utils/                 # Helpers (extraction JSON, polices PDF, diff)
├── Dockerfile                 # Image de production Next.js multi-stage
└── docker-compose.yml         # Démarrage du serveur PostgreSQL
```

---

## 🔑 Configuration des APIs & Environnement

Créez un fichier `.env.local` à la racine du projet :

```env
# ─── Base de Données ─────────────────────────────────────────────────────────
# PostgreSQL pour la persistance des profils et versions de CV.
# La valeur ci-dessous correspond aux identifiants du docker-compose inclus.
DATABASE_URL=postgresql://kompyle:kompyle_dev@localhost:5432/kompyle

# ─── Configuration des Clés d'API IA ─────────────────────────────────────────
# Renseignez au moins une clé. L'application possède un système de fallback
# qui tente d'autres modèles si le premier échoue.

# 1. Google Gemini (Recommandé — modèle par défaut : gemini-2.5-flash)
# Clé gratuite sur : https://aistudio.google.com/
GEMINI_API_KEY=votre_cle_gemini

# 2. Groq (Modèle par défaut : llama-3.3-70b-versatile)
# Clé sur : https://console.groq.com/
GROQ_API_KEY=votre_cle_groq

# 3. Mistral AI (Modèle par défaut : mistral-large-2512)
# Clé sur : https://console.mistral.ai/
MISTRAL_API_KEY=votre_cle_mistral
```

---

## 💿 Démarrage Rapide (Installation Locale)

### 1. Installer les dépendances

```bash
npm install
```

### 2. Démarrer la base de données PostgreSQL

Un `docker-compose.yml` est fourni pour lancer PostgreSQL localement (aucune installation manuelle de Postgres requise) :

```bash
npm run db:up
# ou : docker compose up -d
```

Le schéma est initialisé automatiquement via `scripts/init.sql` au premier démarrage du conteneur.

> **Sans Docker :** si vous avez déjà un serveur PostgreSQL, créez une base `kompyle`, exécutez `scripts/init.sql`, et renseignez `DATABASE_URL` dans `.env.local`.

### 3. Démarrer le serveur de développement

```bash
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000) dans votre navigateur.

### 4. Build de Production

```bash
npm run build
npm run start
```

---

## 🐳 Déploiement avec Docker

Le `docker-compose.yml` inclus démarre **uniquement** la base de données PostgreSQL. L'application Next.js se déploie séparément via le `Dockerfile` fourni.

### Étape 1 — Base de données

```bash
# Démarre PostgreSQL (persiste les données dans un volume Docker)
docker compose up -d
```

### Étape 2 — Application Next.js

```bash
# Compilation de l'image
docker build -t kompyle-app .

# Démarrage avec les variables d'environnement
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://kompyle:kompyle_dev@host.docker.internal:5432/kompyle" \
  -e GEMINI_API_KEY="votre_cle_gemini" \
  -e GROQ_API_KEY="votre_cle_groq" \
  -e MISTRAL_API_KEY="votre_cle_mistral" \
  kompyle-app
```

> Sur Linux, remplacez `host.docker.internal` par l'IP de votre machine hôte ou utilisez `--network host`.

L'application sera disponible sur [http://localhost:3000](http://localhost:3000).

---

## 📄 Licence

Ce projet est sous licence MIT. Pour plus de détails, veuillez consulter le fichier [LICENSE](LICENSE) à la racine du projet.
