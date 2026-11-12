# syntax=docker/dockerfile:1
#
# Kompyle — production image (Next.js 16 "standalone" output, Node 22).
#   docker build -t kompyle .
#   docker run -p 3000:3000 -e DATABASE_URL=... kompyle
# The simplest way to run everything (app + PostgreSQL) is `docker compose up`.

ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine AS base

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
# libc6-compat: some native binaries (e.g. the Tailwind/PostCSS toolchain) expect glibc.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# Retries and a persistent npm cache make the install resilient to flaky networks.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --fetch-retries=5 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=30000

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public URL used for link-preview (OpenGraph) images; inlined at build time.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
# No secret is needed at build time: AI keys are entered in the web UI (BYOK).
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Listen on every interface: inside a container, the default (the container
    # hostname) would not be reachable through the published port.
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# public/ holds the PDF fonts, which are read from disk at render time.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# The standalone output already contains the traced node_modules and server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
