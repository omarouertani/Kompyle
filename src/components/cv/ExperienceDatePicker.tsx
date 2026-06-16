"use client";

import React, { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "@base-ui/react/popover";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  parseExperienceDate,
  formatExperienceDate,
  type ExperienceDateValue,
  type MonthYear,
} from "@/lib/cv-dates";

interface ExperienceDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Classe du déclencheur (texte inline du canvas vs champ du sidebar). */
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
  placeholder?: string;
  /** Affiche une icône calendrier dans le déclencheur (variante champ). */
  withIcon?: boolean;
}

/** Construit un formateur de mois court localisé ("Sep", "Sept", "Mai"…). */
function useMonthName(locale: string) {
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
    return (m: number) => {
      const label = fmt.format(new Date(2000, m, 1)).replace(/\.$/, "");
      return label.charAt(0).toUpperCase() + label.slice(1);
    };
  }, [locale]);
}

/**
 * Sélecteur de période mois/année pour les dates d'expérience. Remplace la saisie
 * libre par un picker contrôlé : deux panneaux (entrée / sortie) + une case « poste
 * actuel » (n'affiche alors que la date d'entrée). La valeur est sérialisée en
 * chaîne canonique « Mois Année - Mois Année » lue par les templates, le PDF et le
 * calcul d'expérience. Utilisable inline dans le canvas comme en champ de formulaire.
 */
export function ExperienceDatePicker({
  value,
  onChange,
  triggerClassName,
  triggerStyle,
  placeholder,
  withIcon = false,
}: ExperienceDatePickerProps) {
  const locale = useLocale();
  const t = useTranslations("DatePicker");
  const monthName = useMonthName(locale);

  const parsed = useMemo(() => parseExperienceDate(value), [value]);
  const display = formatExperienceDate(parsed, monthName);

  const commit = (next: ExperienceDateValue) => onChange(formatExperienceDate(next, monthName));
  const setStart = (my: MonthYear) => commit({ ...parsed, start: my });
  const setEnd = (my: MonthYear) => commit({ ...parsed, end: my, current: false });
  const toggleCurrent = (checked: boolean) =>
    commit({ start: parsed.start, end: checked ? null : parsed.end, current: checked });

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "inline-flex items-center gap-1.5 text-left outline-none rounded transition-colors",
          !display && "text-muted-foreground/60 italic",
          triggerClassName,
        )}
        style={triggerStyle}
      >
        {withIcon && <CalendarDays size={14} className="shrink-0 text-muted-foreground" />}
        <span className="truncate">{display || placeholder || t("placeholder")}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Popover.Popup
            className={cn(
              "z-50 w-[min(92vw,360px)] origin-(--transform-origin) rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-xl ring-1 ring-foreground/5",
              "flex flex-col gap-3",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <div className="grid grid-cols-2 gap-3">
              <MonthYearPanel label={t("start")} value={parsed.start} onSelect={setStart} monthName={monthName} />
              <MonthYearPanel
                label={t("end")}
                value={parsed.end}
                onSelect={setEnd}
                monthName={monthName}
                disabled={parsed.current}
              />
            </div>
            <label className="flex items-center gap-2 border-t border-border/60 pt-2.5 text-sm text-foreground cursor-pointer select-none">
              <Checkbox checked={parsed.current} onCheckedChange={(c) => toggleCurrent(c === true)} />
              {t("current")}
            </label>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface MonthYearPanelProps {
  label: string;
  value: MonthYear | null;
  onSelect: (value: MonthYear) => void;
  monthName: (m: number) => string;
  disabled?: boolean;
}

function MonthYearPanel({ label, value, onSelect, monthName, disabled = false }: MonthYearPanelProps) {
  // Année actuellement affichée pour la navigation : initialisée sur la valeur,
  // sinon l'année courante. Le panneau est remonté à chaque ouverture du popover,
  // donc cette valeur reflète toujours la dernière sélection.
  const [viewYear, setViewYear] = useState(value?.year ?? new Date().getFullYear());

  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-40 pointer-events-none")}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewYear((y) => y - 1)}
          className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="−1"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold tabular-nums">{viewYear}</span>
        <button
          type="button"
          onClick={() => setViewYear((y) => y + 1)}
          className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="+1"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, m) => {
          const active = value?.year === viewYear && value?.month === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onSelect({ year: viewYear, month: m })}
              className={cn(
                "h-7 rounded-md text-xs font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
              )}
            >
              {monthName(m)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
