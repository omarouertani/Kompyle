"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

interface AIAdaptOverlayProps {
  type: "cv" | "letter";
}

/** Ligne skeleton avec shimmer décalé (effet "réécriture en cours"). */
function SkeletonLine({ w, h = "h-1.5", delay = 0 }: { w: string; h?: string; delay?: number }) {
  return (
    <div
      className={`${h} ${w} rounded bg-muted/50 overflow-hidden relative`}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-primary/30 to-transparent"
        style={{ animationDelay: `${delay}ms` }}
      />
    </div>
  );
}

/**
 * Overlay de génération IA — un document A4 flottant, flou en arrière-plan,
 * avec des lignes skeleton qui shimmerent. AUCUNE étape ni progression
 * simulée : le montage/démontage est piloté par l'état réel de la requête
 * (loadingType), donc l'animation dure exactement le temps de la réponse IA.
 * Animations CSS pures (transform/opacity) — rien ne bloque le thread.
 */
export default function AIAdaptOverlay({ type }: AIAdaptOverlayProps) {
  const t = useTranslations("AIAdapt");

  return (
    <div className="absolute inset-0 z-30 bg-background/40 dark:bg-black/35 backdrop-blur-[5px] flex flex-col items-center justify-center gap-6 p-6 select-none animate-in fade-in duration-300">
      <style jsx global>{`
        @keyframes cvFloat {
          0%, 100% { transform: translateY(0) rotate(-0.4deg); }
          50% { transform: translateY(-10px) rotate(0.4deg); }
        }
        .animate-cv-float {
          animation: cvFloat 4.5s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.6s ease-in-out infinite;
          will-change: transform;
        }
      `}</style>

      {/* Document A4 flottant */}
      <div className="animate-cv-float relative aspect-[210/297] h-[300px] sm:h-[400px] lg:h-[440px] w-auto bg-card/80 border border-border/60 shadow-2xl rounded-xl p-5 sm:p-7 flex flex-col gap-4 overflow-hidden blur-[1px]">
        {type === "cv" ? (
          <>
            {/* En-tête */}
            <div className="flex items-center gap-3 border-b border-border/50 pb-4 shrink-0">
              <div className="size-10 rounded-full bg-muted/60 animate-pulse shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <SkeletonLine w="w-28" h="h-3.5" />
                <SkeletonLine w="w-40" h="h-2" delay={200} />
              </div>
            </div>
            {/* Deux colonnes */}
            <div className="flex-1 flex gap-4 min-h-0">
              <div className="w-[30%] border-r border-border/40 pr-3 flex flex-col gap-2.5">
                <SkeletonLine w="w-10" h="h-2" delay={100} />
                <SkeletonLine w="w-full" delay={300} />
                <SkeletonLine w="w-5/6" delay={450} />
                <div className="mt-2" />
                <SkeletonLine w="w-12" h="h-2" delay={150} />
                <SkeletonLine w="w-full" delay={600} />
                <SkeletonLine w="w-4/6" delay={750} />
              </div>
              <div className="flex-1 flex flex-col gap-2.5">
                <SkeletonLine w="w-16" h="h-2" delay={50} />
                <SkeletonLine w="w-full" delay={200} />
                <SkeletonLine w="w-11/12" delay={350} />
                <div className="mt-2" />
                <SkeletonLine w="w-20" h="h-2" delay={100} />
                <SkeletonLine w="w-full" delay={500} />
                <SkeletonLine w="w-5/6" delay={650} />
                <SkeletonLine w="w-full" delay={800} />
                <SkeletonLine w="w-4/5" delay={950} />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Lettre : expéditeur / destinataire */}
            <div className="flex justify-between shrink-0">
              <div className="flex flex-col gap-1.5">
                <SkeletonLine w="w-16" h="h-2.5" />
                <SkeletonLine w="w-24" delay={200} />
              </div>
              <div className="flex flex-col gap-1.5 mt-4 items-end">
                <SkeletonLine w="w-24" h="h-2.5" delay={100} />
                <SkeletonLine w="w-28" delay={300} />
              </div>
            </div>
            <SkeletonLine w="w-40" h="h-3" delay={150} />
            <div className="flex-1 flex flex-col gap-2.5 mt-2">
              <SkeletonLine w="w-full" delay={250} />
              <SkeletonLine w="w-11/12" delay={400} />
              <div className="mt-1.5" />
              <SkeletonLine w="w-full" delay={550} />
              <SkeletonLine w="w-full" delay={700} />
              <SkeletonLine w="w-5/6" delay={850} />
              <div className="mt-1.5" />
              <SkeletonLine w="w-full" delay={1000} />
              <SkeletonLine w="w-11/12" delay={1150} />
            </div>
            <SkeletonLine w="w-36" delay={500} />
          </>
        )}
      </div>

      {/* Libellé d'état — l'overlay est monté/démonté par l'état RÉEL de la
          requête (loadingType), donc l'animation dure EXACTEMENT le temps de la
          réponse IA : pas de pourcentage ni d'étapes simulées. */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2.5 bg-card/90 border border-border/60 rounded-full px-4 py-2 shadow-lg">
          <Sparkles className="size-4 text-primary animate-pulse" />
          <span className="text-sm font-medium text-foreground">
            {type === "cv" ? t("adapting_cv") : t("adapting_letter")}
          </span>
          <span className="flex gap-1 ml-0.5">
            <span className="size-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="size-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="size-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground/90 max-w-[260px] text-center leading-snug">
          {t("hint")}
        </span>
      </div>
    </div>
  );
}
