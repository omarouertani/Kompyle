"use client";

import { useTranslations } from "next-intl";
import type { ATSReport, ATSSubScores } from "@/types/cv";
import { Reveal } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import { ATSScoreChart } from "./ATSScoreChart";
import { cssVarForScore, cssVarForStatus } from "./ats-utils";

interface ATSResultsViewProps {
  report: ATSReport;
}

const SUB_SCORES: { key: keyof ATSSubScores; labelKey: "sub_keywords" | "sub_skills" | "sub_experience" | "sub_formatting" }[] = [
  { key: "keywords", labelKey: "sub_keywords" },
  { key: "skills", labelKey: "sub_skills" },
  { key: "experience", labelKey: "sub_experience" },
  { key: "formatting", labelKey: "sub_formatting" },
];

/**
 * Rapport ATS sur une seule page, du plus important au plus détaillé :
 *   1. score global, verdict et sous-scores
 *   2. mots-clés (manquants d'abord : c'est ce qu'il faut corriger)
 *   3. recommandations et points forts
 *   4. retour section par section
 * La couleur ne porte que le sens (niveau d'un score, statut) ; pas d'icônes.
 */
export function ATSResultsView({ report }: ATSResultsViewProps) {
  const t = useTranslations("ATS");
  const scoreColor = cssVarForScore(report.overallScore);
  const matched = report.matchedKeywords;
  const missing = report.missingKeywords;

  return (
    <div className="flex flex-col gap-4">
      {/* 1 · Score, verdict, sous-scores */}
      <Reveal index={0}>
        <Panel className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
            <ATSScoreChart score={report.overallScore} />
            <div className="flex min-w-0 flex-col gap-2 text-center sm:text-left">
              <Eyebrow>{t("score_caption")}</Eyebrow>
              <div className="font-serif text-2xl font-bold leading-tight" style={{ color: scoreColor }}>
                {report.scoreLabel}
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-foreground/85">{report.summary}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
            {SUB_SCORES.map((row, i) => (
              <SubScore key={row.key} label={t(row.labelKey)} value={report.subScores[row.key]} index={i} />
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* 2 · Mots-clés */}
      <Reveal index={1}>
        <Panel>
          <PanelHeader
            title={t("tab_keywords")}
            meta={t("keywords_coverage", {
              matched: String(matched.length),
              total: String(matched.length + missing.length),
            })}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <KeywordGroup
              title={t("missing_title")}
              count={missing.length}
              color="var(--ats-poor)"
              emptyLabel={t("missing_empty")}
            >
              {missing.map((kw, i) => (
                <span
                  key={`${kw}-${i}`}
                  className="rounded-md border border-dashed border-[color-mix(in_oklab,var(--ats-poor)_45%,transparent)] px-2 py-1 text-xs font-medium text-foreground"
                >
                  {kw}
                </span>
              ))}
            </KeywordGroup>
            <KeywordGroup
              title={t("matched_title")}
              count={matched.length}
              color="var(--ats-excellent)"
              emptyLabel={t("matched_empty")}
            >
              {matched.map((kw, i) => (
                <span
                  key={`${kw.term}-${i}`}
                  title={kw.foundInSection}
                  className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground"
                >
                  {kw.term}
                </span>
              ))}
            </KeywordGroup>
          </div>
        </Panel>
      </Reveal>

      {/* 3 · Recommandations + points forts */}
      <Reveal index={2} className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel>
          <PanelHeader title={t("recommendations_title")} meta={t("recommendations_subtitle")} />
          {report.recommendations.length === 0 ? (
            <Empty>{t("recommendations_empty")}</Empty>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {report.recommendations.map((item, i) => (
                <li key={i} className="flex items-start gap-3 py-3 text-sm leading-relaxed first:pt-0 last:pb-0">
                  <span className="mt-0.5 w-5 shrink-0 font-serif text-sm font-bold tabular-nums text-primary">
                    {i + 1}
                  </span>
                  <span className="text-foreground/90">{item}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel>
          <PanelHeader title={t("strengths_title")} meta={t("strengths_subtitle")} />
          {report.strengths.length === 0 ? (
            <Empty>{t("strengths_empty")}</Empty>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {report.strengths.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90">
                  <Dot color="var(--ats-excellent)" className="mt-[0.55em]" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Reveal>

      {/* 4 · Sections */}
      <Reveal index={3}>
        <Panel>
          <PanelHeader title={t("tab_sections")} />
          {report.sectionFeedback.length === 0 ? (
            <Empty>{t("sections_empty")}</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {report.sectionFeedback.map((s, i) => (
                <li key={`${s.section}-${i}`} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">{s.section}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Dot color={cssVarForStatus(s.status)} />
                      {t(`status_${s.status}`)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.feedback}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-xl border border-border bg-card p-5 sm:p-6", className)}>{children}</section>;
}

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Dot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}

function SubScore({ label, value, index }: { label: string; value: number; index: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">{clamped}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="motion-grow h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: cssVarForScore(clamped), "--i": index + 2 } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

function KeywordGroup({
  title,
  count,
  color,
  emptyLabel,
  children,
}: {
  title: string;
  count: number;
  color: string;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <Dot color={color} />
        {title}
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </div>
      {count === 0 ? <Empty>{emptyLabel}</Empty> : <div className="flex flex-wrap gap-1.5">{children}</div>}
    </div>
  );
}
