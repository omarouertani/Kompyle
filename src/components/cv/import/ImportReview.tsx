"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Briefcase, GraduationCap, Languages, Layers, RotateCcw, User, Wrench, FolderGit2 } from "lucide-react";
import { AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";
import type { ImportCVResponse, ImportedCV } from "@/lib/cv-import/schema";
import type { ImportTarget } from "./CVImportDialog";

interface ImportReviewProps {
  result: ImportCVResponse;
  canCreateProfile: boolean;
  applying: boolean;
  onRestart: () => void;
  onApply: (cv: ImportedCV, target: ImportTarget) => void;
}

/** Écran de vérification : ce qui a été extrait, ce qui manque, et où l'appliquer. */
export function ImportReview({ result, canCreateProfile, applying, onRestart, onApply }: ImportReviewProps) {
  const t = useTranslations("CVImport");
  const { cv, warnings } = result;
  const pi = cv.personalInfo;
  const [mode, setMode] = useState<"replace" | "new">("replace");
  const [profileName, setProfileName] = useState(pi.name || "");

  const contact = [pi.email, pi.phone, pi.location, pi.linkedin, pi.portfolio].filter(Boolean).join(" · ");
  const custom = cv.customSections ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Identité */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        <User size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{pi.name || <span className="text-muted-foreground">{t("missing")}</span>}</p>
          {pi.role && <p className="text-xs text-muted-foreground">{pi.role}</p>}
          {contact && <p className="mt-0.5 break-words text-xs text-muted-foreground">{contact}</p>}
          {pi.summary && <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed">{pi.summary}</p>}
        </div>
      </div>

      {/* Sections extraites */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Section icon={<Briefcase size={14} />} label={t("sec_experience")} count={cv.experiences.length}
          items={cv.experiences.map((e) => [e.title, e.org].filter(Boolean).join(" — ") + (e.date ? ` (${e.date})` : ""))} />
        <Section icon={<GraduationCap size={14} />} label={t("sec_education")} count={cv.education.length}
          items={cv.education.map((e) => [e.degree, e.institution].filter(Boolean).join(" — "))} />
        <Section icon={<Wrench size={14} />} label={t("sec_skills")} count={cv.skills.length}
          items={cv.skills.map((s) => (s.category ? `${s.category} : ${s.items}` : s.items))} />
        <Section icon={<Languages size={14} />} label={t("sec_languages")} count={cv.spokenLanguages.length} items={cv.spokenLanguages} />
        {cv.projects.length > 0 && (
          <Section icon={<FolderGit2 size={14} />} label={t("sec_projects")} count={cv.projects.length} items={cv.projects.map((p) => p.title)} />
        )}
        {custom.length > 0 && (
          <Section icon={<Layers size={14} />} label={t("sec_custom")} count={custom.length} items={custom.map((c) => c.title)} />
        )}
      </div>

      {/* Ce qui manque */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={13} />
            {t("warnings_title")}
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {warnings.map((w) => <li key={w}>{t(`warn_${w}`)}</li>)}
          </ul>
        </div>
      )}

      {/* Où appliquer */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">{t("target_title")}</legend>
        <TargetOption checked={mode === "replace"} onSelect={() => setMode("replace")} title={t("target_replace")} hint={t("target_replace_hint")} />
        {canCreateProfile && (
          <TargetOption checked={mode === "new"} onSelect={() => setMode("new")} title={t("target_new")} hint={t("target_new_hint")}>
            {mode === "new" && (
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder={t("profile_name_placeholder")}
                className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            )}
          </TargetOption>
        )}
      </fieldset>

      <AlertDialogFooter>
        <Button variant="outline" onClick={onRestart} disabled={applying}>
          <RotateCcw size={14} />
          {t("restart")}
        </Button>
        <Button
          onClick={() => onApply(cv, mode === "new" ? { mode: "new", profileName: profileName.trim() } : { mode: "replace" })}
          disabled={applying || (mode === "new" && !profileName.trim())}
        >
          {applying && <Spinner size={14} />}
          {t("apply")}
        </Button>
      </AlertDialogFooter>
    </div>
  );
}

function Section({ icon, label, count, items }: { icon: React.ReactNode; label: string; count: number; items: string[] }) {
  const t = useTranslations("CVImport");
  const shown = items.slice(0, 3);
  return (
    <div className={cn("rounded-lg border px-3 py-2", count === 0 ? "border-dashed border-border text-muted-foreground" : "border-border")}>
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <span className={count ? "text-primary" : ""}>{icon}</span>
        {label}
        <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] font-medium">{count}</span>
      </p>
      {count === 0 ? (
        <p className="mt-1 text-[11px]">{t("none_found")}</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {shown.map((s, i) => <li key={i} className="truncate text-[11px] text-muted-foreground" title={s}>{s}</li>)}
          {items.length > shown.length && <li className="text-[11px] text-muted-foreground">{t("and_more", { count: items.length - shown.length })}</li>}
        </ul>
      )}
    </div>
  );
}

function TargetOption({ checked, onSelect, title, hint, children }: { checked: boolean; onSelect: () => void; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <label className={cn("cursor-pointer rounded-lg border px-3 py-2 transition-colors", checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
      <span className="flex items-start gap-2">
        <input type="radio" checked={checked} onChange={onSelect} className="mt-0.5 accent-[var(--primary)]" />
        <span className="flex-1">
          <span className="block text-xs font-semibold">{title}</span>
          <span className="block text-[11px] leading-snug text-muted-foreground">{hint}</span>
          {children}
        </span>
      </span>
    </label>
  );
}
