import React, { type ComponentProps, type ReactNode } from "react";
import {
  Page as PdfPage,
  Text as PdfText,
  View as PdfView,
  Link as PdfLink,
} from "@react-pdf/renderer";
import { usePdfTheme } from "./theme";
import {
  composeStyles,
  composeLinkStyles,
  safeTextStyle,
  headingSafeLineHeight,
  type StyleInput,
} from "./styles";
import {
  hasInlineHtml,
  stripHtml,
  parseInlineHtml,
  toPdfRunStyle,
  inheritableTextStyle,
} from "@/utils/inline-html";

/**
 * If `children` is a string carrying inline formatting markup (B/I/U/S, color,
 * size, font, alignment) produced by the canvas editor, parse it into styled
 * runs so every `<Text>`/`<Link>` in every template reflects canvas formatting
 * in the PDF — no per-call-site change needed. Plain strings (and non-string
 * children) pass through untouched. `composedStyle` is the parent's resolved
 * style; its text-level props cascade into each run so weight/case/size/font
 * are preserved while the run's own tweaks win.
 */
/** Text-ish prop bag — react-pdf's Text/Link prop types are unions whose SVG
 *  branch lacks `children`, so we intersect a `children` field to destructure it. */
type TextLikeProps = ComponentProps<typeof PdfText> & { children?: ReactNode };
type LinkLikeProps = ComponentProps<typeof PdfLink> & { children?: ReactNode };

function renderRichChildren(children: ReactNode, composedStyle: unknown): ReactNode {
  if (typeof children !== "string" || !hasInlineHtml(children)) return children;
  const runs = parseInlineHtml(children);
  if (runs.length === 0) return null;
  const base = inheritableTextStyle(composedStyle);
  return runs.map((run, i) => (
    <PdfText key={i} style={{ ...base, ...(run.style ? toPdfRunStyle(run.style) : {}) } as never}>
      {run.text}
    </PdfText>
  ));
}

/**
 * Primitives PDF de Kompyle — surcouches intelligentes de @react-pdf/renderer,
 * adaptées des primitives de Reactive Resume (packages/pdf/.../primitives.tsx).
 *
 * Chaque primitive :
 *   1. injecte la typographie globale (depuis le thème),
 *   2. applique le style local fourni par l'appelant,
 *   3. termine par `safeTextStyle` (anti-débordement / anti-page-blanche).
 * L'ordre garantit que les défauts sont surchargeables mais que les garde-fous
 * de sécurité gagnent toujours.
 */

// ─── Conteneur ────────────────────────────────────────────────────────────────

/** <View> : passe-plat qui normalise la composition de styles (tableaux/condi). */
export const View = ({ style, ...props }: ComponentProps<typeof PdfView>) => (
  <PdfView style={composeStyles(style as StyleInput)} {...props} />
);

/** Alias sémantique (nommage RR). */
export const Div = View;

/**
 * <KeepTogether> : bloc qui ne sera JAMAIS coupé entre deux pages.
 * `wrap={false}` → si le bloc ne tient pas en bas de page, il bascule en entier
 * sur la page suivante. À réserver aux blocs courts et atomiques (en-tête
 * d'expérience, item d'éducation…) — un bloc plus haut qu'une page déborderait.
 */
export const KeepTogether = ({ style, ...props }: ComponentProps<typeof PdfView>) => (
  <PdfView wrap={false} style={composeStyles(style as StyleInput)} {...props} />
);

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * <Page> : injecte la typographie globale à la racine pour que tout texte en
 * hérite. On garde le wrap par défaut (true) pour laisser le contenu s'écouler
 * naturellement sur plusieurs pages.
 */
export const Page = ({ style, ...props }: ComponentProps<typeof PdfPage>) => {
  const theme = usePdfTheme();
  return (
    <PdfPage
      style={composeStyles(
        {
          fontFamily: theme.fontFamily,
          fontSize: theme.fontSize,
          lineHeight: theme.lineHeight,
          color: theme.color,
        },
        style as StyleInput,
      )}
      {...props}
    />
  );
};

// ─── Texte ──────────────────────────────────────────────────────────────────

/** Corps de texte standard. Protège orphelines/veuves par défaut. */
export const Text = ({ style, children, ...props }: TextLikeProps) => {
  const theme = usePdfTheme();
  const composed = composeStyles(
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      lineHeight: theme.lineHeight,
      color: theme.color,
    },
    style as StyleInput,
    safeTextStyle,
  );
  return (
    <PdfText orphans={2} widows={2} style={composed} {...props}>
      {renderRichChildren(children, composed)}
    </PdfText>
  );
};

/** Titre (gras + lineHeight plancher sûr pour éviter le rognage des jambages). */
export const Heading = ({ style, children, ...props }: TextLikeProps) => {
  const theme = usePdfTheme();
  const composed = composeStyles(
    {
      fontFamily: theme.fontFamily,
      fontWeight: theme.boldWeight,
      color: theme.color,
      lineHeight: headingSafeLineHeight,
    },
    style as StyleInput,
    safeTextStyle,
  );
  return (
    <PdfText style={composed} {...props}>
      {renderRichChildren(children, composed)}
    </PdfText>
  );
};

/** Texte en gras (hérite de la taille du corps). */
export const Bold = ({ style, children, ...props }: TextLikeProps) => {
  const theme = usePdfTheme();
  const composed = composeStyles(
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      fontWeight: theme.boldWeight,
      lineHeight: theme.lineHeight,
      color: theme.color,
    },
    style as StyleInput,
    safeTextStyle,
  );
  return (
    <PdfText style={composed} {...props}>
      {renderRichChildren(children, composed)}
    </PdfText>
  );
};

/** Petit texte atténué (légendes, sous-titres, stacks…). */
export const Small = ({ style, children, ...props }: TextLikeProps) => {
  const theme = usePdfTheme();
  const composed = composeStyles(
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize * theme.smallScale,
      lineHeight: theme.lineHeight,
      color: theme.mutedColor,
    },
    style as StyleInput,
    safeTextStyle,
  );
  return (
    <PdfText style={composed} {...props}>
      {renderRichChildren(children, composed)}
    </PdfText>
  );
};

/** Lien (sans soulignage par défaut, cf. design des contacts de Kompyle).
 *  Sanitise toujours `src` (strip HTML) pour qu'un libellé formaté n'injecte
 *  pas de balises dans l'URL, et rend le libellé en texte riche. */
export const Link = ({ style, children, src, ...props }: LinkLikeProps) => {
  const theme = usePdfTheme();
  const composed = composeLinkStyles(
    { hideUnderline: true },
    {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      lineHeight: theme.lineHeight,
      color: theme.color,
    },
    style as StyleInput,
    safeTextStyle,
  );
  const cleanSrc = typeof src === "string" ? stripHtml(src) : src;
  return (
    <PdfLink src={cleanSrc} style={composed} {...props}>
      {renderRichChildren(children, composed)}
    </PdfLink>
  );
};
