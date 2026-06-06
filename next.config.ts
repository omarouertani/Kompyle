import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './src/i18n/request.ts'
);

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@react-pdf/renderer"],
  output: "standalone",
};

export default withNextIntl(nextConfig);
