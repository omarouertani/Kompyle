"use client";

import React, { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun, Globe, Layers, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
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
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
          <Layers size={16} />
        </div>
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="font-serif text-lg font-semibold tracking-tight text-foreground">
            Kompyle
          </span>
        </Link>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
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
