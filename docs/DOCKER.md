# Déploiement Docker (monorepo)

Une image par app (`auth`, `dispensary`), construite depuis la **racine du monorepo** pour inclure automatiquement les packages workspace (`@lawless-intranet/*`).

## Principe

```
docker build (context: .)
    │
    ├─ turbo prune auth|dispensary --docker   → apps + packages nécessaires
    ├─ pnpm install
    ├─ pnpm turbo build --filter=<app>        → next build --webpack + standalone
    └─ entrypoint: prisma migrate deploy + node apps/<app>/server.js
```

Équivalent de l’ancien flux (`npm install` → `prisma migrate deploy` → `build` → `start`), mais découpé en deux conteneurs.

## Prérequis

- Docker + Docker Compose
- Réseau `proxy` externe (nginx-proxy / letsencrypt-companion), comme avant
- Deux bases PostgreSQL (auth + dispensary)
- Discord redirect URI : `https://<AUTH_VIRTUAL_HOST>/api/auth/callback/discord`

## Démarrage rapide

```bash
cp docker/.env.example .env.docker
# Éditer .env.docker (URLs, DB, secrets, VIRTUAL_HOST)

docker compose --env-file .env.docker up -d --build
```

## Build manuel d’une app

```bash
# Auth (port 3001)
docker build \
  --build-arg APP_NAME=auth \
  --build-arg APP_PORT=3001 \
  -t lawless-auth .

# Dispensary (port 3000)
docker build \
  --build-arg APP_NAME=dispensary \
  --build-arg APP_PORT=3000 \
  -t lawless-dispensary .
```

## Variables importantes en prod

| Variable | App | Rôle |
|----------|-----|------|
| `AUTH_PUBLIC_URL` | auth + dispensary | URL publique IdP — **build + runtime** (`NEXT_PUBLIC_AUTH_URL`) |
| `DISPENSARY_PUBLIC_URL` | auth + dispensary | URL publique RP — **build + runtime** (`NEXT_PUBLIC_APP_URL`) |
| `AUTH_COOKIE_DOMAIN` | auth | Domaine cookie SSO (ex. `.example.com`) |
| `AUTH_DATABASE_URL` | auth | DB auth |
| `DISPENSARY_DATABASE_URL` | dispensary | DB métier |
| `AUTH_INTERNAL_SECRET` | auth + dispensary | API interne service-to-service |

## Migration depuis l’ancien déploiement mono-app

1. Copier les users vers la DB auth : `pnpm migrate:users-to-auth`
2. Déployer **auth** en premier (migrations auth)
3. Déployer **dispensary** (migrations sans tables User)
4. Mettre à jour Discord : callback sur le domaine auth

## Notes

- Les migrations Prisma s’exécutent au **démarrage** du conteneur (`docker/docker-entrypoint.sh`), pas au build — pas besoin d’accès DB pendant `docker build`.
- Au runtime : image **standalone** Next.js (`node apps/<app>/server.js`) — `node_modules` tracés, build **webpack** (pas turbopack).
- Migrations via `prisma` CLI global dans l’image.
- **Important** : les variables `NEXT_PUBLIC_*` sont **inlinées au build** (logout, login client, etc.). Les mettre dans `docker-compose.yml` `environment:` seul ne suffit pas — il faut rebuild après changement d’URL (`build.args` dans compose).
- `DATABASE_URL` factice est utilisée uniquement pour `prisma generate` pendant le build.
- Pour le dev local, continuez avec `pnpm dev` (pas Docker).
