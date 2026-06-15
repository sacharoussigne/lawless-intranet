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
# At runtime, each container gets its own DATABASE_URL via docker-compose:
#   auth       → AUTH_DATABASE_URL
#   dispensary → DISPENSARY_DATABASE_URL
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Inline env ensures turbo/pnpm pass DATABASE_URL (turbo strict env mode).
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    pnpm turbo build --filter="${APP_NAME}"

# Portable deploy dir (app + workspace packages + node_modules)
RUN pnpm --filter="${APP_NAME}" deploy --legacy /deploy

# pnpm deploy ignores .next (gitignored) — copy build output explicitly
RUN cp -r "/app/apps/${APP_NAME}/.next" /deploy/.next

# --- Runtime ---
FROM base AS runner
ARG APP_NAME
ARG APP_PORT

WORKDIR /deploy

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT="${APP_PORT}"
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=builder --chown=nextjs:nodejs /deploy .

USER nextjs

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["pnpm", "start"]
