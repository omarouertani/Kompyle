# Graph Report - .  (2026-06-11)

## Corpus Check
- Corpus is ~46,999 words - fits in a single context window. You may not need a graph.

## Summary
- 574 nodes · 1059 edges · 45 communities (25 shown, 20 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Canvas Block Editing System|Canvas Block Editing System]]
- [[_COMMUNITY_CV Builder & API Layer|CV Builder & API Layer]]
- [[_COMMUNITY_CV PDF Template|CV PDF Template]]
- [[_COMMUNITY_Cover Letter Template & PDF|Cover Letter Template & PDF]]
- [[_COMMUNITY_AI Orchestration Pipeline|AI Orchestration Pipeline]]
- [[_COMMUNITY_UI Primitives & Layout|UI Primitives & Layout]]
- [[_COMMUNITY_AI JSON Schema Validation|AI JSON Schema Validation]]
- [[_COMMUNITY_App Shell & i18n|App Shell & i18n]]
- [[_COMMUNITY_CV Editor UI (Screenshot 2)|CV Editor UI (Screenshot 2)]]
- [[_COMMUNITY_Preview & Cover Letter Components|Preview & Cover Letter Components]]
- [[_COMMUNITY_CV Builder App View (Screenshot 1)|CV Builder App View (Screenshot 1)]]
- [[_COMMUNITY_PDF Primitives Library|PDF Primitives Library]]
- [[_COMMUNITY_AI Adapt Overlay & CV Preview|AI Adapt Overlay & CV Preview]]
- [[_COMMUNITY_Multi-Provider AI & Layout Utils|Multi-Provider AI & Layout Utils]]
- [[_COMMUNITY_Cover Letter Builder Form|Cover Letter Builder Form]]
- [[_COMMUNITY_CV Profiles REST API|CV Profiles REST API]]
- [[_COMMUNITY_PDF Font Registry|PDF Font Registry]]
- [[_COMMUNITY_Card UI Component|Card UI Component]]
- [[_COMMUNITY_Project Assets & Identity|Project Assets & Identity]]
- [[_COMMUNITY_Form Input Components|Form Input Components]]
- [[_COMMUNITY_DB Seed Script|DB Seed Script]]
- [[_COMMUNITY_Alert UI Component|Alert UI Component]]
- [[_COMMUNITY_Tooltip UI Component|Tooltip UI Component]]
- [[_COMMUNITY_Tabs UI Component|Tabs UI Component]]
- [[_COMMUNITY_Sidebar Nav Components|Sidebar Nav Components]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Badge UI Component|Badge UI Component]]
- [[_COMMUNITY_CV Section Layout Utils|CV Section Layout Utils]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Infrastructure (Docker + README)|Infrastructure (Docker + README)]]
- [[_COMMUNITY_Select & Tabs Wrappers|Select & Tabs Wrappers]]
- [[_COMMUNITY_Sidebar Provider|Sidebar Provider]]
- [[_COMMUNITY_Skeleton Loading|Skeleton Loading]]
- [[_COMMUNITY_Profile Manager & Status|Profile Manager & Status]]
- [[_COMMUNITY_ESLint Rules|ESLint Rules]]
- [[_COMMUNITY_Sidebar State Hook|Sidebar State Hook]]
- [[_COMMUNITY_Textarea Component|Textarea Component]]
- [[_COMMUNITY_Remove Custom Section|Remove Custom Section]]
- [[_COMMUNITY_Class Merge Utility|Class Merge Utility]]
- [[_COMMUNITY_AI Extraction Result Type|AI Extraction Result Type]]
- [[_COMMUNITY_Text Wrap Utility|Text Wrap Utility]]
- [[_COMMUNITY_URL Format Utility|URL Format Utility]]
- [[_COMMUNITY_URL Display Utility|URL Display Utility]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 94 edges
2. `CV Types` - 16 edges
3. `CVData` - 15 edges
4. `defaultLayout()` - 14 edges
5. `CVInteractiveCanvas` - 14 edges
6. `CVData interface` - 13 edges
7. `Button()` - 11 edges
8. `composeStyles()` - 10 edges
9. `CVTemplate` - 10 edges
10. `CVTemplateChaima` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Data Immutability (anti-hallucination pattern)` --rationale_for--> `CVData interface`  [INFERRED]
  README.md → src/types/cv.ts
- `Interactive Canvas Editor` --conceptually_related_to--> `CVLayout interface`  [INFERRED]
  README.md → src/types/cv.ts
- `Zod Schema + Self-Healing (anti-hallucination)` --rationale_for--> `resumeSchema (Zod root)`  [EXTRACTED]
  README.md → src/schemas/resumeSchema.ts
- `AI CV Adaptation feature` --references--> `AIProvider type`  [INFERRED]
  README.md → src/types/cv.ts
- `AI CV Adaptation feature` --references--> `AdaptCVRequest interface`  [INFERRED]
  README.md → src/types/cv.ts

## Hyperedges (group relationships)
- **AI CV Adaptation Pipeline** — api_adapt_cv, lib_ai_orchestrator, lib_rate_limiter, schemas_resume_schema, utils_ai_helpers [INFERRED 0.95]
- **Cover Letter Generation Pipeline** — api_generate_cover_letter, lib_ai_orchestrator, lib_rate_limiter, schemas_resume_schema [INFERRED 0.95]
- **CV Profiles CRUD API** — api_cv_profiles, api_cv_profiles_id, lib_db, db_table_cv_profiles [EXTRACTED 1.00]
- **Locale App Shell** — locale_layout, locale_page, component_header, component_theme_provider, i18n_routing [INFERRED 0.90]
- **Main Page UI Orchestration** — locale_page, hook_use_profile_manager, hook_use_ai_provider_config, hook_use_ai_submission, component_cv_builder, component_cover_letter_builder, component_cover_letter_preview [INFERRED 0.90]
- **PDF Rendering: Cover Letter** — component_cover_letter_preview, component_cover_letter_template, utils_pdf_fonts [EXTRACTED 1.00]

## Communities (45 total, 20 thin omitted)

### Community 0 - "Canvas Block Editing System"
Cohesion: 0.05
Nodes (60): AbsoluteBlock(), AbsoluteBlockProps, HANDLES, BlockContent(), BlockContentProps, BlockTheme, SECTION_LABELS, CanvasToolbar() (+52 more)

### Community 1 - "CV Builder & API Layer"
Cohesion: 0.07
Nodes (55): AbsoluteBlock, AIAdaptOverlay, API Route: Adapt CV, API Route: CV Profiles (Collection), API Route: CV Profile (By ID), API Route: Generate Cover Letter, BlockContent, CanvasSectionHeading (+47 more)

### Community 2 - "CV PDF Template"
Cohesion: 0.06
Nodes (23): CVTemplate(), CVTemplateProps, getStyles(), renderContact(), SECTION_RENDERERS, SectionRenderer, CVTemplateChaima(), CVTemplateChaimaProps (+15 more)

### Community 3 - "Cover Letter Template & PDF"
Cohesion: 0.07
Nodes (32): CoverLetterPreviewProps, CoverLetterTemplateProps, FONT_FAMILY, styles, StatusBanner, StatusBannerProps, PROVIDER_MODELS, useAIProviderConfig() (+24 more)

### Community 4 - "AI Orchestration Pipeline"
Cohesion: 0.09
Nodes (33): buildCorrectionPrompt(), POST(), POST(), callWithFallback(), CallWithFallbackResult, DEFAULT_MODELS, callGemini(), callGroq() (+25 more)

### Community 5 - "UI Primitives & Layout"
Cohesion: 0.11
Nodes (35): useIsMobile(), cn(), Separator(), SheetContent(), SheetDescription(), SheetHeader(), SheetTitle(), Sidebar() (+27 more)

### Community 6 - "AI JSON Schema Validation"
Cohesion: 0.08
Nodes (37): extractAndValidate, extractJsonString, lightRepairJson, parseAiJson, AIProvider type, AdaptCVRequest interface, AdaptCVResponse interface, CVData interface (+29 more)

### Community 7 - "App Shell & i18n"
Cohesion: 0.12
Nodes (14): Header Component, Theme Provider, ThemeProvider(), i18n Request Config, i18n Routing Config, {Link, redirect, usePathname, useRouter}, routing, Locale Root Layout (+6 more)

### Community 8 - "CV Editor UI (Screenshot 2)"
Cohesion: 0.14
Nodes (20): Add Section Button, Agency CV Menu / Tab, Appearance & Applications Panel, Breadcrumb Navigation, CV Canvas / Preview Area, CV Competences Section, CV Contact Section, CV Document (Omar Ouertani) (+12 more)

### Community 9 - "Preview & Cover Letter Components"
Cohesion: 0.15
Nodes (11): Header(), HeaderProps, CoverLetterPreview(), CVPreview(), Button(), ButtonProps, buttonVariants, Checkbox() (+3 more)

### Community 10 - "CV Builder App View (Screenshot 1)"
Cohesion: 0.14
Nodes (18): Analyse CV Button, Aperçu CV Tab (Preview Tab), Kompyle Application Shell, CV Document – Omar Ouertani, CV Editor View, CV Preview Panel, CV Contact Section, Dark Theme UI (+10 more)

### Community 11 - "PDF Primitives Library"
Cohesion: 0.24
Nodes (15): Bold(), Heading(), KeepTogether(), Link(), Page(), Small(), Text(), View() (+7 more)

### Community 12 - "AI Adapt Overlay & CV Preview"
Cohesion: 0.15
Nodes (13): AIAdaptOverlay(), AIAdaptOverlayProps, CVPreviewProps, CVVersion, SelectContent(), SelectGroup(), SelectItem(), SelectLabel() (+5 more)

### Community 13 - "Multi-Provider AI & Layout Utils"
Cohesion: 0.15
Nodes (17): callWithFallback Function, callGemini Function, callGroq Function, callMistral Function, addCustomSection Function, computeDefaultPositions Function, defaultLayout Function, PostgreSQL Connection Pool (+9 more)

### Community 14 - "Cover Letter Builder Form"
Cohesion: 0.27
Nodes (4): CoverLetterBuilderProps, Input, Label(), Textarea()

### Community 16 - "PDF Font Registry"
Cohesion: 0.25
Nodes (8): ACTIVE_PDF_FONT constant, PDF_FONTS registry, PdfFontDefinition interface, PdfFontVariant interface, registerPdfFont, DiffText component, PDF Export (react-pdf/renderer), Text Diffing (visual diff feature)

### Community 17 - "Card UI Component"
Cohesion: 0.25
Nodes (7): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle()

### Community 18 - "Project Assets & Identity"
Cohesion: 0.39
Nodes (8): File Icon (Document with folded corner), Globe / Web Icon, Kompyle Project, Next.js Wordmark Logo, Next.js Framework, Vercel Deployment Platform, Vercel Triangle Logo, Browser / App Window Icon

### Community 19 - "Form Input Components"
Cohesion: 0.4
Nodes (6): Checkbox Component, Input Component, Label Component, Separator Component, Sheet Component, Sidebar Component

### Community 20 - "DB Seed Script"
Cohesion: 0.4
Nodes (3): dataDir, pool, profiles

### Community 21 - "Alert UI Component"
Cohesion: 0.5
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 22 - "Tooltip UI Component"
Cohesion: 0.4
Nodes (4): Tooltip(), TooltipContent(), TooltipProvider(), TooltipTrigger()

### Community 23 - "Tabs UI Component"
Cohesion: 0.5
Nodes (3): TabsContent(), TabsList(), TabsTrigger()

### Community 24 - "Sidebar Nav Components"
Cohesion: 0.5
Nodes (4): SidebarMenuButton, Tooltip Component, TooltipContent, TooltipTrigger

## Knowledge Gaps
- **166 isolated node(s):** `eslintConfig`, `withNextIntl`, `nextConfig`, `config`, `pool` (+161 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `UI Primitives & Layout` to `Canvas Block Editing System`, `Cover Letter Template & PDF`, `Preview & Cover Letter Components`, `AI Adapt Overlay & CV Preview`, `Cover Letter Builder Form`, `Card UI Component`, `Alert UI Component`, `Tooltip UI Component`, `Tabs UI Component`, `Badge UI Component`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `CV Types` (e.g. with `AI Adapt Overlay` and `CVTemplate`) actually correct?**
  _`CV Types` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `CVInteractiveCanvas` (e.g. with `useMarquee` and `CVTemplate`) actually correct?**
  _`CVInteractiveCanvas` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `eslintConfig`, `withNextIntl`, `nextConfig` to the rest of the system?**
  _166 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Canvas Block Editing System` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `CV Builder & API Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `CV PDF Template` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._