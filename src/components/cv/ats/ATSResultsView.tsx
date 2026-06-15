"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Layers, ListChecks, Gauge } from "lucide-react";
import type { ATSReport } from "@/types/cv";
import { ATSScoreChart } from "./ATSScoreChart";
import { ATSSubScoresPanel } from "./ATSSubScores";
import { ATSKeywords } from "./ATSKeywords";
import { ATSSections } from "./ATSSections";
import { ATSRecommendations } from "./ATSRecommendations";

interface ATSResultsViewProps {
  report: ATSReport;
}

/**
 * Vue résultats — 4 onglets pour ne pas noyer l'utilisateur :
 *   Overview · Mots-clés · Sections · Recommandations
 * Le radial chart se ré-anime à chaque retour sur l'onglet Overview.
 */
export function ATSResultsView({ report }: ATSResultsViewProps) {
  const t = useTranslations("ATS");

  return (
    <Tabs defaultValue="overview" className="flex flex-col gap-5">
      <TabsList className="self-start h-10">
        <TabsTrigger value="overview" className="gap-2 text-sm px-4">
          <Gauge size={15} />
          {t("tab_overview")}
        </TabsTrigger>
        <TabsTrigger value="keywords" className="gap-2 text-sm px-4">
          <Tag size={15} />
          {t("tab_keywords")}
        </TabsTrigger>
        <TabsTrigger value="sections" className="gap-2 text-sm px-4">
          <Layers size={15} />
          {t("tab_sections")}
        </TabsTrigger>
        <TabsTrigger value="recommendations" className="gap-2 text-sm px-4">
          <ListChecks size={15} />
          {t("tab_recommendations")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4">
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8">
            <ATSScoreChart
              score={report.overallScore}
              label={report.scoreLabel}
              caption={t("score_caption")}
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {t("verdict_title")}
              </div>
              <p className="text-base leading-relaxed text-foreground/90">{report.summary}</p>
            </div>
            <ATSSubScoresPanel subScores={report.subScores} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="keywords" className="flex flex-col gap-4">
        <ATSKeywords matched={report.matchedKeywords} missing={report.missingKeywords} />
      </TabsContent>

      <TabsContent value="sections" className="flex flex-col gap-4">
        <ATSSections sections={report.sectionFeedback} />
      </TabsContent>

      <TabsContent value="recommendations" className="flex flex-col gap-4">
        <ATSRecommendations recommendations={report.recommendations} strengths={report.strengths} />
      </TabsContent>
    </Tabs>
  );
}
