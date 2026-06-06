"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

// Suppress the React 19 warning for the script tag injected by next-themes
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const origError = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("Encountered a script tag")) {
      return;
    }
    origError.apply(console, args);
  };
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
