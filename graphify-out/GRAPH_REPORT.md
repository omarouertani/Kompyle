# Graph Report - Kompyle  (2026-06-12)

## Corpus Check
- 75 files · ~52,544 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 607 nodes · 1131 edges · 47 communities (27 shown, 20 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6892f358`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 94 edges
2. `defaultLayout()` - 17 edges
3. `CV Types` - 16 edges
4. `CVData` - 15 edges
5. `CVInteractiveCanvas` - 14 edges
6. `CVData interface` - 13 edges
7. `Button()` - 11 edges
8. `sectionTitle()` - 10 edges
9. `sectionTitle()` - 10 edges
10. `composeStyles()` - 10 edges

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

## Communities (47 total, 20 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (53): AbsoluteBlock(), AbsoluteBlockProps, HANDLES, BlockContent(), CanvasToolbar(), CanvasToolbarProps, ContextMenu(), ContextMenuItem (+45 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (55): AbsoluteBlock, AIAdaptOverlay, API Route: Adapt CV, API Route: CV Profiles (Collection), API Route: CV Profile (By ID), API Route: Generate Cover Letter, BlockContent, CanvasSectionHeading (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (43): CoverLetterTemplateProps, FONT_FAMILY, styles, CVTemplateProps, getStyles(), renderCertifications(), renderContact(), renderEducation() (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (24): CoverLetterBuilderProps, StatusBanner, StatusBannerProps, useAIProviderConfig(), useAISubmission(), UseAISubmissionDeps, CVProfile, fallbackDataChaimaEn (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (40): buildCorrectionPrompt(), POST(), POST(), PROVIDER_MODELS, callWithFallback(), CallWithFallbackResult, DEFAULT_MODELS, callGemini() (+32 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (35): useIsMobile(), cn(), Separator(), SheetContent(), SheetDescription(), SheetHeader(), SheetTitle(), Sidebar() (+27 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (37): extractAndValidate, extractJsonString, lightRepairJson, parseAiJson, AIProvider type, AdaptCVRequest interface, AdaptCVResponse interface, CVData interface (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (14): Header Component, Theme Provider, ThemeProvider(), i18n Request Config, i18n Routing Config, {Link, redirect, usePathname, useRouter}, routing, Locale Root Layout (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (20): Add Section Button, Agency CV Menu / Tab, Appearance & Applications Panel, Breadcrumb Navigation, CV Canvas / Preview Area, CV Competences Section, CV Contact Section, CV Document (Omar Ouertani) (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (22): 1. Installation des Dépendances, 2. Démarrage du Serveur de Développement, 3. Build de Production, Build Manuel avec Docker CLI, code:mermaid (graph LR), code:env (# ─── Configuration des Clés d'API IA ──────────────────────), code:bash (npm install), code:bash (npm run dev) (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (18): Analyse CV Button, Aperçu CV Tab (Preview Tab), Kompyle Application Shell, CV Document – Omar Ouertani, CV Editor View, CV Preview Panel, CV Contact Section, Dark Theme UI (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.24
Nodes (15): Bold(), Heading(), KeepTogether(), Link(), Page(), Small(), Text(), View() (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (14): BlockContentProps, BlockTheme, SECTION_LABELS, CanvasSectionHeading, CanvasSectionHeadingProps, EditableText(), CVBuilderProps, ListSection (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (17): callWithFallback Function, callGemini Function, callGroq Function, callMistral Function, addCustomSection Function, computeDefaultPositions Function, defaultLayout Function, PostgreSQL Connection Pool (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (12): CVPreview(), CVPreviewProps, CVVersion, SelectContent(), SelectGroup(), SelectItem(), SelectLabel(), SelectScrollDownButton() (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (8): ACTIVE_PDF_FONT constant, PDF_FONTS registry, PdfFontDefinition interface, PdfFontVariant interface, registerPdfFont, DiffText component, PDF Export (react-pdf/renderer), Text Diffing (visual diff feature)

### Community 17 - "Community 17"
Cohesion: 0.23
Nodes (9): Header(), HeaderProps, AIAdaptOverlay(), AIAdaptOverlayProps, CoverLetterPreview(), CoverLetterPreviewProps, Button(), ButtonProps (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.39
Nodes (8): File Icon (Document with folded corner), Globe / Web Icon, Kompyle Project, Next.js Wordmark Logo, Next.js Framework, Vercel Deployment Platform, Vercel Triangle Logo, Browser / App Window Icon

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (6): Checkbox Component, Input Component, Label Component, Separator Component, Sheet Component, Sidebar Component

### Community 20 - "Community 20"
Cohesion: 0.4
Nodes (3): dataDir, pool, profiles

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (7): Badge(), badgeVariants, Checkbox(), Input, TabsContent(), TabsList(), TabsTrigger()

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (7): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle()

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (4): SidebarMenuButton, Tooltip Component, TooltipContent, TooltipTrigger

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (3): Sheet(), SheetFooter(), SheetOverlay()

### Community 45 - "Community 45"
Cohesion: 0.5
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 46 - "Community 46"
Cohesion: 0.4
Nodes (4): Tooltip(), TooltipContent(), TooltipProvider(), TooltipTrigger()

## Knowledge Gaps
- **179 isolated node(s):** `pool`, `CVPreview`, `CoverLetterPreview`, `LeftTab`, `RightTab` (+174 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 5` to `Community 0`, `Community 3`, `Community 12`, `Community 45`, `Community 14`, `Community 46`, `Community 17`, `Community 21`, `Community 23`, `Community 26`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `CV Types` (e.g. with `AI Adapt Overlay` and `CVTemplate`) actually correct?**
  _`CV Types` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `CVInteractiveCanvas` (e.g. with `useMarquee` and `CVTemplate`) actually correct?**
  _`CVInteractiveCanvas` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `pool`, `CVPreview`, `CoverLetterPreview` to the rest of the system?**
  _179 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._