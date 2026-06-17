import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './src/i18n/request.ts'
);

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@react-pdf/renderer"],
  output: "standalone",
  // Pastille « N » des dev tools Next : déplacée hors de la sidebar (dev-only,
  // absente du build de production de toute façon).
  devIndicators: {
    position: "bottom-right",
  },
};

export default withNextIntl(nextConfig);
