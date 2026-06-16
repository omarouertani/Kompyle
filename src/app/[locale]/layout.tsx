import type { Metadata } from "next";
import {
  Inter,
  Playfair_Display,
  Lato,
  Montserrat,
  Poppins,
  Open_Sans,
  Source_Sans_3,
  Merriweather,
  Gelasio,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

// ── Pack de polices pro (synchronisé avec pdf-fonts.ts pour parité canvas↔PDF).
//    next/font auto-héberge les .ttf ; les .ttf gstatic équivalents sont
//    enregistrés côté PDF. Poids 400/700 + italiques pour couvrir gras/italique.
//    NOTE: next/font exige des tableaux LITTÉRAUX pour weight/style (pas de spread). ──
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-lato", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-montserrat", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-poppins", display: "swap" });
const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-opensans", display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-sourcesans", display: "swap" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-merriweather", display: "swap" });
const gelasio = Gelasio({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-gelasio", display: "swap" });

export const metadata: Metadata = {
  title: "Kompyle — Premium CV Adapter",
  description: "Adapt your CV intelligently using AI.",
};

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={[
        inter.variable,
        playfair.variable,
        lato.variable,
        montserrat.variable,
        poppins.variable,
        openSans.variable,
        sourceSans.variable,
        merriweather.variable,
        gelasio.variable,
      ].join(" ")}
      suppressHydrationWarning
    >
      <body className={inter.className} suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
