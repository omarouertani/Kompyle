import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './src/i18n/request.ts'
);

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@react-pdf/renderer"],
  output: "standalone",
  // Les polices PDF sont lues sur disque par react-pdf (src/utils/pdf-fonts.ts) :
  // les embarquer dans la route serveur (utile hors Docker, ex. Vercel).
  outputFileTracingIncludes: {
    "/api/render-pdf": ["./public/fonts/**/*"],
  },
  // Pastille « N » des dev tools Next : déplacée hors de la sidebar (dev-only,
  // absente du build de production de toute façon).
  devIndicators: {
    position: "bottom-right",
  },
};

export default withNextIntl(nextConfig);
