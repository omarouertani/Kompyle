"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, Cpu, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIAdaptOverlayProps {
  type: "cv" | "letter";
}

export default function AIAdaptOverlay({ type }: AIAdaptOverlayProps) {
  const t = useTranslations("AIAdapt");
  const [currentStep, setCurrentStep] = useState(0);
  const [activeGlowIndex, setActiveGlowIndex] = useState(0);

  // Sync step increments over time to show progress
  useEffect(() => {
    const intervals = [2000, 2500, 2500, 2500]; // Duration for each step in ms
    let timer: NodeJS.Timeout;

    const runNext = (index: number) => {
      if (index >= intervals.length) return;
      timer = setTimeout(() => {
        setCurrentStep(index + 1);
        runNext(index + 1);
      }, intervals[index]);
    };

    runNext(0);
    return () => clearTimeout(timer);
  }, []);

  // Sync active glowing field for the rewriting simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveGlowIndex((prev) => (prev + 1) % 5);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  const steps = type === "cv" 
    ? ["cv_step1", "cv_step2", "cv_step3", "cv_step4", "cv_step5"]
    : ["letter_step1", "letter_step2", "letter_step3", "letter_step4", "letter_step5"];

  const progressPercentage = Math.min(((currentStep + 0.5) / steps.length) * 100, 95);

  return (
    <div className="absolute inset-0 z-30 bg-background/40 dark:bg-black/35 backdrop-blur-[5px] flex flex-col lg:flex-row items-center justify-center gap-8 p-6 lg:p-12 select-none animate-in fade-in duration-300">
      
      {/* CSS Keyframes for laser scanning and neon pulsing */}
      <style jsx global>{`
        @keyframes laserScan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .animate-laser {
          animation: laserScan 4s ease-in-out infinite;
        }
      `}</style>

      {/* ── Left Side: A4 Document Mockup ── */}
      <div className="relative aspect-[210/297] h-[320px] sm:h-[440px] lg:h-[480px] w-auto bg-card border border-border/80 shadow-2xl rounded-xl p-5 sm:p-7 flex flex-col gap-4 overflow-hidden shrink-0 scale-95 sm:scale-100 transition-all duration-300">
        
        {/* Glowing Laser Scan Bar */}
        <div className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_rgba(var(--primary),0.8),0_0_4px_rgba(var(--primary),0.5)] z-20 pointer-events-none animate-laser" />

        {/* ── CV Mode Template Skeleton ── */}
        {type === "cv" ? (
          <div className="flex-1 flex flex-col gap-4">
            {/* Header Block */}
            <div className="flex items-center gap-4 border-b border-border/50 pb-4 shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted/65 animate-pulse shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className={cn(
                  "h-4 w-24 sm:w-32 rounded transition-all duration-500",
                  activeGlowIndex === 0 
                    ? "bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_8px_rgba(139,92,246,0.3)] animate-pulse" 
                    : "bg-muted/70"
                )} />
                <div className={cn(
                  "h-2.5 w-36 sm:w-48 rounded transition-all duration-500",
                  activeGlowIndex === 0 
                    ? "bg-gradient-to-r from-violet-400 to-indigo-400 shadow-[0_0_8px_rgba(139,92,246,0.2)] animate-pulse" 
                    : "bg-muted/50"
                )} />
              </div>
            </div>

            {/* Content Columns */}
            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left Column (Sidebar) */}
              <div className="w-[30%] border-r border-border/40 pr-3 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="h-2 w-10 bg-muted/80 rounded" />
                  <div className="h-1.5 w-full bg-muted/40 rounded" />
                  <div className="h-1.5 w-5/6 bg-muted/40 rounded" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-2 w-12 bg-muted/80 rounded" />
                  {/* Skills tags simulation */}
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "h-3 w-8 sm:w-10 rounded transition-all duration-500",
                          activeGlowIndex === 3 
                            ? "bg-gradient-to-r from-violet-500/80 to-fuchsia-500/80 animate-pulse border-violet-400/20" 
                            : "bg-muted/50"
                        )} 
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column (Experiences) */}
              <div className="flex-1 flex flex-col gap-4">
                {/* Profile summary block */}
                <div className="flex flex-col gap-1.5">
                  <div className="h-2 w-16 bg-muted/80 rounded" />
                  <div className={cn(
                    "h-1.5 w-full rounded transition-all duration-500",
                    activeGlowIndex === 1 
                      ? "bg-gradient-to-r from-violet-400 to-indigo-400 animate-pulse" 
                      : "bg-muted/40"
                  )} />
                  <div className={cn(
                    "h-1.5 w-11/12 rounded transition-all duration-500",
                    activeGlowIndex === 1 
                      ? "bg-gradient-to-r from-violet-400 to-indigo-400 animate-pulse" 
                      : "bg-muted/40"
                  )} />
                </div>

                {/* Experience blocks */}
                <div className="flex flex-col gap-3">
                  <div className="h-2 w-20 bg-muted/80 rounded" />
                  
                  {/* Exp 1 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <div className="h-2 w-24 bg-muted/65 rounded" />
                      <div className="h-1.5 w-12 bg-muted/30 rounded" />
                    </div>
                    <div className={cn(
                      "h-1.5 w-full rounded transition-all duration-500",
                      activeGlowIndex === 2 
                        ? "bg-gradient-to-r from-violet-500/80 via-fuchsia-500/80 to-indigo-500/80 shadow-[0_0_8px_rgba(139,92,246,0.3)] animate-pulse" 
                        : "bg-muted/40"
                    )} />
                    <div className={cn(
                      "h-1.5 w-5/6 rounded transition-all duration-500",
                      activeGlowIndex === 2 
                        ? "bg-gradient-to-r from-violet-400/80 via-fuchsia-400/80 to-indigo-400/80 animate-pulse" 
                        : "bg-muted/40"
                    )} />
                  </div>

                  {/* Exp 2 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <div className="h-2 w-28 bg-muted/65 rounded" />
                      <div className="h-1.5 w-12 bg-muted/30 rounded" />
                    </div>
                    <div className={cn(
                      "h-1.5 w-full rounded transition-all duration-500",
                      activeGlowIndex === 4 
                        ? "bg-gradient-to-r from-violet-500/80 via-fuchsia-500/80 to-indigo-500/80 shadow-[0_0_8px_rgba(139,92,246,0.3)] animate-pulse" 
                        : "bg-muted/40"
                    )} />
                    <div className={cn(
                      "h-1.5 w-4/5 rounded transition-all duration-500",
                      activeGlowIndex === 4 
                        ? "bg-gradient-to-r from-violet-400/80 via-fuchsia-400/80 to-indigo-400/80 animate-pulse" 
                        : "bg-muted/40"
                    )} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Cover Letter Mode Template Skeleton ── */
          <div className="flex-1 flex flex-col gap-4">
            {/* Sender / Recipient */}
            <div className="flex justify-between shrink-0 mb-2">
              <div className="flex flex-col gap-1.5">
                <div className="h-2.5 w-16 bg-muted/70 rounded" />
                <div className="h-1.5 w-24 bg-muted/40 rounded" />
              </div>
              <div className="flex flex-col gap-1.5 mt-4 items-end">
                <div className="h-2.5 w-24 bg-muted/70 rounded" />
                <div className="h-1.5 w-28 bg-muted/40 rounded" />
              </div>
            </div>
            
            {/* Date */}
            <div className="h-2 w-20 bg-muted/50 rounded self-end mb-2" />
            
            {/* Subject */}
            <div className={cn(
              "h-3 w-40 rounded transition-all duration-500",
              activeGlowIndex === 0 
                ? "bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_8px_rgba(139,92,246,0.3)] animate-pulse" 
                : "bg-muted/70"
            )} />

            {/* Salutation */}
            <div className="h-2 w-16 bg-muted/60 rounded mb-1" />

            {/* Letter Body Paragraphs */}
            <div className="flex-1 flex flex-col gap-3.5 mt-1">
              {/* Para 1 */}
              <div className="flex flex-col gap-1.5">
                <div className={cn(
                  "h-1.5 w-full rounded transition-all duration-500",
                  activeGlowIndex === 1 
                    ? "bg-gradient-to-r from-violet-400 to-indigo-400 animate-pulse" 
                    : "bg-muted/40"
                )} />
                <div className={cn(
                  "h-1.5 w-11/12 rounded transition-all duration-500",
                  activeGlowIndex === 1 
                    ? "bg-gradient-to-r from-violet-400 to-indigo-400 animate-pulse" 
                    : "bg-muted/40"
                )} />
              </div>

              {/* Para 2 */}
              <div className="flex flex-col gap-1.5">
                <div className={cn(
                  "h-1.5 w-full rounded transition-all duration-500",
                  activeGlowIndex === 2 
                    ? "bg-gradient-to-r from-violet-500/80 via-fuchsia-500/80 to-indigo-500/80 shadow-[0_0_8px_rgba(139,92,246,0.3)] animate-pulse" 
                    : "bg-muted/40"
                )} />
                <div className={cn(
                  "h-1.5 w-full rounded transition-all duration-500",
                  activeGlowIndex === 2 
                    ? "bg-gradient-to-r from-violet-400/80 via-fuchsia-400/80 to-indigo-400/80 animate-pulse" 
                    : "bg-muted/40"
                )} />
                <div className={cn(
                  "h-1.5 w-5/6 rounded transition-all duration-500",
                  activeGlowIndex === 2 
                    ? "bg-gradient-to-r from-violet-400/80 via-fuchsia-400/80 to-indigo-400/80 animate-pulse" 
                    : "bg-muted/40"
                )} />
              </div>

              {/* Para 3 */}
              <div className="flex flex-col gap-1.5">
                <div className={cn(
                  "h-1.5 w-full rounded transition-all duration-500",
                  activeGlowIndex === 3 
                    ? "bg-gradient-to-r from-violet-500/80 via-fuchsia-500/80 to-indigo-500/80 shadow-[0_0_8px_rgba(139,92,246,0.3)] animate-pulse" 
                    : "bg-muted/40"
                )} />
                <div className={cn(
                  "h-1.5 w-11/12 rounded transition-all duration-500",
                  activeGlowIndex === 3 
                    ? "bg-gradient-to-r from-violet-400/80 via-fuchsia-400/80 to-indigo-400/80 animate-pulse" 
                    : "bg-muted/40"
                )} />
              </div>
            </div>

            {/* Signoff */}
            <div className={cn(
              "h-1.5 w-36 rounded transition-all duration-500",
              activeGlowIndex === 4 
                ? "bg-gradient-to-r from-violet-400 to-indigo-400 animate-pulse" 
                : "bg-muted/50"
            )} />
          </div>
        )}
      </div>

      {/* ── Right Side: AI Progress HUD Card ── */}
      <div className="bg-card/95 border border-border/80 backdrop-blur-md shadow-2xl rounded-2xl p-6 w-full max-w-[340px] md:max-w-[360px] flex flex-col gap-5 shrink-0 scale-95 sm:scale-100 transition-all duration-300">
        {/* Header HUD info */}
        <div className="flex items-center gap-3 border-b border-border/40 pb-3">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Cpu className="size-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wider uppercase text-foreground">CO-PILOTE IA KOMPYLE</h3>
            <p className="text-[10px] text-muted-foreground font-mono">{t("scanning")}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full">
            <Sparkles className="size-3 animate-spin" style={{ animationDuration: '3s' }} />
            <span>ACTIF</span>
          </div>
        </div>

        {/* Vertical Stepper Checkpoints */}
        <div className="flex flex-col gap-4 my-1">
          {steps.map((stepKey, idx) => {
            const isDone = idx < currentStep;
            const isActive = idx === currentStep;
            const isPending = idx > currentStep;

            return (
              <div 
                key={stepKey} 
                className={cn(
                  "flex items-start gap-3 text-xs font-medium transition-all duration-300",
                  isPending ? "text-muted-foreground/50" : isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {/* Step Marker */}
                <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                  {isDone ? (
                    <div className="size-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                      <Check className="size-3" />
                    </div>
                  ) : isActive ? (
                    <div className="size-5 rounded-full bg-primary/15 border border-primary flex items-center justify-center text-primary">
                      <Loader2 className="size-3 animate-spin" />
                    </div>
                  ) : (
                    <div className="size-5 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground/60">
                      {idx + 1}
                    </div>
                  )}
                  {/* Vertical Connection Line */}
                  {idx < steps.length - 1 && (
                    <div className={cn(
                      "absolute top-5 bottom-[-20px] left-[9px] w-[1.5px]",
                      idx < currentStep ? "bg-emerald-500/30" : "bg-border/60"
                    )} />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={cn(
                    "truncate leading-none",
                    isActive && "font-bold text-primary",
                    isDone && "line-through text-muted-foreground/60"
                  )}>
                    {t(stepKey)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress HUD Footer */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
          <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground font-mono">
            <span>COMPRESSION & RENDU</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary via-violet-500 to-indigo-500 transition-all duration-500 ease-out rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
