"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PROVIDER_META, PROVIDER_MODELS, providerForModel } from "@/hooks/use-ai-provider-config";
import type { AIProvider } from "@/types/cv";

interface ModelSelectProps {
  /** Identifiant de modèle sélectionné (le provider en découle). */
  model: string;
  /** Appelé avec le nouvel identifiant de modèle. */
  onModelChange: (model: string) => void;
  disabled?: boolean;
  /** Libellé optionnel affiché au-dessus du sélecteur. */
  label?: string;
  /** Classes du conteneur (label + sélecteur). */
  className?: string;
  /** Élève le menu au-dessus d'un dialog (z-index > overlay). */
  elevated?: boolean;
  /** Nœud de portail du menu — à passer dans un dialog modal pour que le
   *  popup reste dans le focus-trap (clic + clavier fonctionnels). */
  menuContainer?: HTMLElement | null;
  /** Mode icône seule (pour intégrer dans une barre de PromptInput) : déclencheur
   *  réduit à la pastille du provider, menu compact ouvert vers le bas. */
  compact?: boolean;
}

/**
 * Sélecteur unifié fournisseur + modèle IA (pastille de marque + groupes par
 * provider). Source unique — réutilisé par le sidebar IA, l'adaptation ATS et
 * le dialogue d'audit ATS pour ne JAMAIS dupliquer ce markup.
 */
export function ModelSelect({ model, onModelChange, disabled, label, className, elevated, menuContainer, compact }: ModelSelectProps) {
  const provider = providerForModel(model);

  // Liste de groupes provider/modèles — identique aux deux modes (source unique).
  const options = (
    <>
      {(Object.keys(PROVIDER_MODELS) as AIProvider[]).map((prov) => (
        <SelectGroup key={prov}>
          <SelectLabel className="flex items-center gap-2 px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: PROVIDER_META[prov].color }} />
            {PROVIDER_META[prov].label}
          </SelectLabel>
          {PROVIDER_MODELS[prov].map((m) => (
            <SelectItem key={m.model} value={m.model} className="cursor-pointer rounded-lg text-sm">
              {m.name}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );

  // ── Mode icône seule (barre de PromptInput) ──
  if (compact) {
    return (
      <Select value={model} onValueChange={(v) => v && onModelChange(v)} disabled={disabled}>
        <SelectTrigger
          className={cn("h-9 w-fit max-w-[180px] gap-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors px-2.5", className)}
          title={PROVIDER_META[provider].label}
        >
          <span
            className="size-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background"
            style={{ backgroundColor: PROVIDER_META[provider].color, boxShadow: `0 0 0 2px ${PROVIDER_META[provider].color}30` }}
          />
          {/* Nom du modèle sélectionné, tronqué si trop long. */}
          <SelectValue className="truncate text-[0.8rem] font-semibold" />
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="start"
          sideOffset={6}
          alignItemWithTrigger={false}
          container={menuContainer ?? undefined}
          positionerClassName={elevated ? "z-[110] pointer-events-auto" : undefined}
          className="w-64 max-h-72 border border-border shadow-xl rounded-lg p-1.5"
        >
          {options}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pl-0.5">
          {label}
        </span>
      )}
      <Select value={model} onValueChange={(v) => v && onModelChange(v)} disabled={disabled}>
        <SelectTrigger className="w-full h-11 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors px-3">
          <span className="flex items-center gap-2.5 min-w-0">
            <span
              className="size-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background"
              style={{ backgroundColor: PROVIDER_META[provider].color, boxShadow: `0 0 0 2px ${PROVIDER_META[provider].color}30` }}
            />
            <span className="flex flex-col items-start min-w-0 leading-tight">
              <span className="text-[10px] text-muted-foreground truncate">{PROVIDER_META[provider].label}</span>
              <SelectValue className="text-sm font-semibold" />
            </span>
          </span>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          container={menuContainer ?? undefined}
          positionerClassName={elevated ? "z-[110] pointer-events-auto" : undefined}
          className="border border-border shadow-xl rounded-lg p-1.5"
        >
          {options}
        </SelectContent>
      </Select>
    </div>
  );
}
