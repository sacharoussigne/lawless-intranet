# Realtime websocket server (apps/realtime) — plain Node, no Next.js / Prisma.
# Build from the monorepo root:
#   docker build -f docker/realtime.Dockerfile -t lawless-realtime .

FROM node:22.23.2-alpine3.24 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate

# --- Prune monorepo to the realtime app + workspace deps ---
FROM base AS prune
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.5.0 prune realtime --docker

# --- Install & bundle (esbuild inlines workspace packages and dependencies) ---
FROM base AS builder
WORKDIR /app
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile

COPY --from=prune /app/out/full/ .
RUN pnpm turbo build --filter=realtime

# --- Runtime: a single bundled file ---
FROM node:22.23.2-alpine3.24 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV WS_PORT=3007
ENV INTERNAL_PORT=3008

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 realtime

COPY --from=builder --chown=realtime:nodejs /app/apps/realtime/dist/server.mjs ./server.mjs

USER realtime
EXPOSE 3007 3008

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${INTERNAL_PORT}/health" > /dev/null || exit 1

CMD ["node", "server.mjs"]
