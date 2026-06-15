# Monorepo image — one app per build (auth | dispensary).
# Build: docker build --build-arg APP_NAME=auth --build-arg APP_PORT=3001 -t lawless-auth .
#        docker build --build-arg APP_NAME=dispensary --build-arg APP_PORT=3000 -t lawless-dispensary .

ARG APP_NAME=dispensary
ARG APP_PORT=3000

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate

# --- Prune monorepo to this app + workspace deps (packages/*) ---
FROM base AS prune
ARG APP_NAME
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@^2 prune "${APP_NAME}" --docker

# --- Install & build ---
FROM base AS builder
ARG APP_NAME
WORKDIR /app

COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=prune /app/out/full/ .

ENV NEXT_TELEMETRY_DISABLED=1
# Dummy URL for `prisma generate` at build time only (no real DB connection).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Webpack build + standalone output (avoids turbopack hashed externals at runtime).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    pnpm turbo build --filter="${APP_NAME}"

# Self-contained Prisma CLI for runtime migrations (npm flat install).
RUN npm install prisma@7.8.0 --prefix /prisma-tools --omit=dev

# --- Runtime (Next.js standalone — traced node_modules) ---
FROM node:22-alpine AS runner
ARG APP_NAME
ARG APP_PORT

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_NAME="${APP_NAME}"
ENV PORT="${APP_PORT}"
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=builder /prisma-tools /prisma-tools

# Standalone bundle (monorepo layout: apps/<name>/server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/prisma ./apps/${APP_NAME}/prisma
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/prisma.config.mjs ./apps/${APP_NAME}/prisma.config.mjs

USER nextjs

ENTRYPOINT ["/docker-entrypoint.sh"]
