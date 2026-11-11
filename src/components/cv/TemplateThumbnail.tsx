import React from "react";
import { getTemplateDef } from "@/lib/cv-templates";

/**
 * Vignette d'un modèle de CV, dessinée en SVG à partir de son moteur et de son
 * thème (aucun fichier image à régénérer quand un modèle change). Elle donne
 * la structure (colonnes, photo, en-tête) et les couleurs, pas le texte.
 */
export function TemplateThumbnail({ templateId, className }: { templateId: string; className?: string }) {
  const { engine, theme } = getTemplateDef(templateId);
  const accent = theme.primaryColor || (engine === "canadian" ? "#1f2d3d" : "#1a1a1a");
  const text = theme.textColor || "#27272a";
  const page = theme.pageBg || "#ffffff";
  const sidebar = theme.sidebarBg && theme.sidebarBg !== "transparent" ? theme.sidebarBg : undefined;

  /** Lignes de texte grisées d'un bloc. */
  const lines = (x: number, y: number, w: number, n: number) =>
    Array.from({ length: n }, (_, i) => (
      <rect key={i} x={x} y={y + i * 7} width={i === n - 1 ? w * 0.6 : w} height={3} rx={1.5} fill={text} opacity={0.28} />
    ));
  const title = (x: number, y: number, w: number) => <rect x={x} y={y} width={w} height={4.5} rx={1} fill={accent} />;

  let body: React.ReactNode;
  if (engine === "modern") {
    body = (
      <>
        <rect x={0} y={0} width={70} height={297} fill={sidebar ?? "#f4f4f5"} />
        <circle cx={35} cy={32} r={17} fill="#d4d4d8" stroke={accent} strokeWidth={2.5} />
        {title(10, 64, 34)}
        {lines(10, 74, 50, 3)}
        {title(10, 104, 30)}
        {lines(10, 114, 50, 4)}
        {title(10, 150, 36)}
        {lines(10, 160, 50, 3)}
        <rect x={82} y={18} width={100} height={11} rx={2} fill={text} opacity={0.85} />
        <rect x={82} y={34} width={70} height={5} rx={2} fill={accent} />
        {title(82, 62, 40)}
        {lines(82, 72, 116, 3)}
        {title(82, 102, 46)}
        {lines(82, 112, 116, 5)}
        {lines(82, 152, 116, 4)}
        {title(82, 190, 38)}
        {lines(82, 200, 116, 3)}
      </>
    );
  } else if (engine === "canadian") {
    body = (
      <>
        <rect x={16} y={18} width={110} height={11} rx={2} fill={text} opacity={0.85} />
        <rect x={16} y={34} width={80} height={5} rx={2} fill={accent} />
        <rect x={16} y={44} width={150} height={3} rx={1.5} fill={text} opacity={0.4} />
        {title(16, 62, 44)}
        <rect x={16} y={69} width={178} height={0.8} fill={accent} />
        {lines(16, 75, 178, 3)}
        {title(16, 104, 50)}
        <rect x={16} y={111} width={178} height={0.8} fill={accent} />
        {lines(16, 117, 178, 6)}
        {title(16, 168, 40)}
        <rect x={16} y={175} width={178} height={0.8} fill={accent} />
        {lines(16, 181, 178, 4)}
      </>
    );
  } else {
    body = (
      <>
        <rect x={16} y={14} width={110} height={11} rx={2} fill={text} opacity={0.85} />
        <rect x={16} y={30} width={80} height={5} rx={2} fill={accent} />
        <rect x={16} y={44} width={178} height={1.2} fill={accent} />
        {sidebar && <rect x={10} y={52} width={62} height={237} rx={2} fill={sidebar} />}
        {title(16, 60, 32)}
        {lines(16, 70, 50, 3)}
        {title(16, 100, 30)}
        {lines(16, 110, 50, 4)}
        {title(16, 146, 36)}
        {lines(16, 156, 50, 3)}
        {title(82, 60, 40)}
        {lines(82, 70, 112, 3)}
        {title(82, 100, 46)}
        {lines(82, 110, 112, 5)}
        {lines(82, 150, 112, 4)}
        {title(82, 188, 38)}
        {lines(82, 198, 112, 3)}
      </>
    );
  }

  return (
    <svg viewBox="0 0 210 297" className={className} aria-hidden="true">
      <rect x={0} y={0} width={210} height={297} fill={page} />
      {body}
      <rect x={0.5} y={0.5} width={209} height={296} fill="none" stroke="#000" strokeOpacity={0.12} />
    </svg>
  );
}
