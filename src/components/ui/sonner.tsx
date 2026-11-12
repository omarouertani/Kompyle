"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      position="bottom-right"
      // Pas de richColors (vert / rouge génériques) : fond du thème, et seule
      // l'icône + un liseré gauche portent la couleur de l'état.
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !shadow-lg !border-l-4",
          title: "!font-semibold",
          description: "!text-muted-foreground",
          success: "!border-l-success [&_[data-icon]]:!text-success",
          error: "!border-l-destructive [&_[data-icon]]:!text-destructive",
          warning: "!border-l-warning [&_[data-icon]]:!text-warning",
          info: "!border-l-primary/60 [&_[data-icon]]:!text-primary",
          actionButton: "!bg-primary !text-primary-foreground !font-semibold !rounded-md",
          cancelButton: "!bg-muted !text-foreground !rounded-md",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
