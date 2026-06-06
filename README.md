# 🚀 Kompyle

**Kompyle** est une application web moderne et performante conçue pour adapter intelligemment des CV et générer des lettres de motivation ciblées en fonction d'offres d'emploi. L'application s'appuie sur la puissance de l'Intelligence Artificielle pour analyser, formuler et optimiser vos candidatures en quelques secondes.

Inspiré des meilleurs standards de design (palette moderne, typographie soignée et interface dynamique type *Reactive Resume*), Kompyle intègre un système de panneau rétractable pour travailler de manière optimale.

---

## ✨ Fonctionnalités Clés

*   **Adaptation Automatique par IA** : Collez la description du poste visé et laissez l'IA reformuler et réorganiser vos expériences pour matcher parfaitement avec l'offre.
*   **Multi-Modèles d'IA** : Choix flexible du modèle d'exécution (via **Google Gemini** ou **Groq Llama**) selon vos préférences de vitesse et de pertinence.
*   **Visualisation Côte-à-Côte** : Comparez votre CV d'origine et le CV adapté en temps réel. Les modifications apportées par l'IA (ajouts/suppressions) sont clairement surlignées pour un contrôle total.
*   **Générateur de Lettre de Motivation** : Rédigez une lettre de motivation sur-mesure pour le poste cible en un seul clic.
*   **Gestionnaire de Mise en Page Interactif** : Déplacez les sections par glisser-déposer (DnD), masquez les éléments non pertinents et répartissez le contenu sur plusieurs pages.
*   **Export PDF Haute Résolution** : Téléchargez vos CV et lettres de motivation au format PDF avec des conventions de nommage professionnelles (`CV_Nom_Titre.pdf` et `Lettre_de_motivation_Titre.pdf`).

---

## 🛠️ Stack Technique

*   **Framework** : Next.js 14+ (App Router, Routeurs localisés)
*   **Design** : Tailwind CSS, shadcn/ui, Lucide Icons, et thème dynamique (Sombre/Clair)
*   **Génération PDF** : `@react-pdf/renderer` (avec rendu asynchrone sécurisé contre les duplications)
*   **Drag & Drop** : `@dnd-kit/core` & `@dnd-kit/sortable`
*   **Internationalisation** : `next-intl` (Français / Anglais)

---

## 🚀 Démarrage Rapide

### 1. Installation Locale

Assurez-vous d'avoir [Node.js](https://nodejs.org/) installé sur votre machine.

```bash
# Cloner le projet
git clone https://github.com/omarouertani/Kompyle.git
cd Kompyle

# Installer les dépendances
npm install
```

### 2. Configuration des Variables d'Environnement

Créez un fichier `.env.local` à la racine du projet et ajoutez vos clés API :

```env
# Clé d'API Google Gemini
GEMINI_API_KEY=votre_cle_gemini

# Clé d'API Groq (Optionnel)
GROQ_API_KEY=votre_cle_groq
```

### 3. Lancer le Serveur de Développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur pour utiliser Kompyle.

---

## 🐳 Déploiement avec Docker

Kompyle est prêt pour la conteneurisation et peut être démarré en production très simplement grâce à Docker.

### Utiliser Docker Compose (Recommandé)

1. Renseignez vos clés API dans votre environnement ou directement dans un fichier `.env` à la racine :
   ```env
   GEMINI_API_KEY=votre_cle_gemini
   GROQ_API_KEY=votre_cle_groq
   ```

2. Démarrez le service :
   ```bash
   docker-compose up -d --build
   ```

L'application sera compilée puis disponible en mode production sur le port `3000` ([http://localhost:3000](http://localhost:3000)).

### Build et Run Manuel avec Docker

Si vous préférez compiler l'image manuellement :

```bash
# 1. Build de l'image de production (multi-stage optimisé pour réduire le poids)
docker build -t kompyle-app .

# 2. Lancement du conteneur en passant les clés d'API requises
docker run -p 3000:3000 \
  -e GEMINI_API_KEY="votre_cle_gemini" \
  -e GROQ_API_KEY="votre_cle_groq" \
  kompyle-app
```

---

## 📁 Structure du Projet

```text
├── src/
│   ├── app/                 # Pages et Routing multilingue (Next.js App Router)
│   ├── components/
│   │   ├── cv/              # CVBuilder, CVPreview, CVTemplate et LayoutManager
│   │   ├── ui/              # Composants graphiques réutilisables (Button, Input, Sidebar...)
│   │   └── Header.tsx       # Barre de navigation supérieure globale
│   ├── lib/                 # Logique métier et configuration par défaut du CV
│   ├── utils/               # Utilitaires système (gestion de la police PDF, etc.)
│   └── types/               # Typages TypeScript (types des données CV et Layout)
├── public/                  # Assets statiques et polices
├── Dockerfile               # Recette de build Docker de production
└── docker-compose.yml       # Configuration du conteneur Docker Compose
```

---

## 📄 Licence

Ce projet est la propriété exclusive de son créateur. Toute reproduction ou distribution sans accord préalable est interdite.
