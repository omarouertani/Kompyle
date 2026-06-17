"use client";

import React, { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun, Globe, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiKeysDialog } from "@/components/ApiKeysDialog";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

interface HeaderProps {
  toggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export default function Header({ toggleSidebar, isSidebarCollapsed }: HeaderProps) {
  const t = useTranslations("Header");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = theme === "dark" ? "light" : "dark";
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Pas de View Transitions (Firefox) ou motion réduit → bascule directe.
    if (!doc.startViewTransition || reduce) {
      setTheme(next);
      return;
    }

    // Ondulation circulaire qui jaillit du bouton cliqué et recouvre l'écran.
    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = doc.startViewTransition(() => {
      // next-themes applique la classe via un useEffect (asynchrone) → le snapshot
      // "new" serait capturé avec l'ANCIEN thème, d'où le flash. On bascule la
      // classe nous-mêmes, de façon synchrone, pour un snapshot correct, puis on
      // resynchronise l'état next-themes (qui réappliquera la même classe).
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(next);
      root.style.colorScheme = next;
      setTheme(next);
    });
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 700,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  };

  const nextLocale = locale === "fr" ? "en" : "fr";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-6 z-20">
      {/* Logo */}
      <div className="flex items-center gap-3">
        {toggleSidebar && isSidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="size-8 text-muted-foreground hover:text-foreground mr-1"
            title="Toggle Sidebar"
          >
            <PanelLeftOpen size={18} />
          </Button>
        )}
        <Link href="/" aria-label="Kompyle" className="flex items-center group">
          <Logo className="h-6 text-foreground transition-opacity group-hover:opacity-80" />
        </Link>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Clés API — visible en haut, séparé des bascules thème/langue par un divider. */}
        <ApiKeysDialog />
        <span className="mx-1.5 h-5 w-px bg-border" aria-hidden />
        {mounted ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={t("toggle_theme")}
            aria-label={t("toggle_theme")}
            className="size-9 text-muted-foreground"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
        ) : (
          <div className="size-9" />
        )}
        <Link
          href="/"
          locale={nextLocale}
          title={t("switch_language")}
          aria-label={t("switch_language")}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground gap-1.5 font-semibold")}
        >
          <Globe size={15} />
          {locale.toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
