# Déploiement Docker (monorepo)

Une image par app (`auth`, `dispensary`, `documents`, `agenda`), construite depuis la **racine du monorepo** pour inclure automatiquement les packages workspace (`@lawless-intranet/*`).

## Principe

```
docker build (context: .)
    │
    ├─ turbo prune auth|dispensary|documents|agenda --docker   → apps + packages nécessaires
    ├─ pnpm install
    ├─ pnpm turbo build --filter=<app>        → next build --webpack + standalone
    └─ entrypoint: prisma migrate deploy + node apps/<app>/server.js
```

## Prérequis

- Docker + Docker Compose
- Réseau `proxy` externe (nginx-proxy / letsencrypt-companion), comme avant
- Quatre bases PostgreSQL (auth + dispensary + documents + agenda)
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

# Documents (port 3002)
docker build \
  --build-arg APP_NAME=documents \
  --build-arg APP_PORT=3002 \
  -t lawless-documents .

# Agenda (port 3003)
docker build \
  --build-arg APP_NAME=agenda \
  --build-arg APP_PORT=3003 \
  -t lawless-agenda .
```

## Variables importantes en prod

| Variable | App | Rôle |
|----------|-----|------|
| `AUTH_PUBLIC_URL` | auth + dispensary | URL publique IdP — **build + runtime** (`NEXT_PUBLIC_AUTH_URL`) |
| `DISPENSARY_PUBLIC_URL` | auth + dispensary | URL publique RP — **build + runtime** (`NEXT_PUBLIC_APP_URL`) |
| `DOCUMENTS_PUBLIC_URL` | documents + dispensary | URL service documents (`DOCUMENTS_URL` côté dispensary) |
| `AGENDA_PUBLIC_URL` | agenda + dispensary | URL service agenda (`AGENDA_URL` côté dispensary) |
| `BANK_PUBLIC_URL` | bank + dispensary | URL service banque (`BANK_URL` côté dispensary) |
| `AUTH_COOKIE_DOMAIN` | auth | Domaine cookie SSO (ex. `.example.com`). Cookie name prefix is `lawless-intranet` (not `better-auth`) to avoid collisions with other apps on the same domain. |
| `AUTH_DATABASE_URL` | auth | DB auth |
| `DISPENSARY_DATABASE_URL` | dispensary | DB métier |
| `DOCUMENTS_DATABASE_URL` | documents | DB documents/templates |
| `AGENDA_DATABASE_URL` | agenda | DB agendas/events/todos |
| `BANK_DATABASE_URL` | bank | DB ledger bancaire |
| `AUTH_INTERNAL_SECRET` | auth + dispensary | API interne service-to-service |
| `AGENDA_INTERNAL_SECRET` | agenda + dispensary | Secret host→agenda pour ops `scopeAdmin` / create |
| `BANK_INTERNAL_SECRET` | bank + dispensary | Secret host→bank (from-order, purge-scope) |
| `BANK_BOT_API_SECRET` | bank + dispensary | Secret bot materialize-planned |
| `DOCUMENTS_INTERNAL_SECRET` | documents + dispensary | Secret host→documents (toutes les routes API sauf health) |

## Migration bank depuis l’ancien stockage dispensary

**Ordre critique** — à exécuter **une fois**, avant que dispensary n’applique `extract_bank_to_service` :

```bash
# 1. Créer la BDD bank et appliquer les migrations (tables vides)
#    → déployer le conteneur bank OU prisma migrate deploy sur BANK_DATABASE_URL

# 2. Copier les données (préserve les UUIDs)
DISPENSARY_DATABASE_URL="$DISPENSARY_DATABASE_URL" \
BANK_DATABASE_URL="$BANK_DATABASE_URL" \
pnpm migrate:bank-to-service

# 3. Déployer dispensary (migrate deploy droppe les tables bank locales)
```

## Migration agenda depuis l’ancien stockage dispensary

**Ordre critique** — à exécuter **une fois**, avant que dispensary n’applique `remove_agenda_tables` :

```bash
# 1. Créer la BDD agenda et appliquer les migrations (tables vides)
#    → déployer le conteneur agenda OU prisma migrate deploy sur AGENDA_DATABASE_URL

# 2. Copier les données (préserve les UUIDs)
DISPENSARY_DATABASE_URL="$DISPENSARY_DATABASE_URL" \
AGENDA_DATABASE_URL="$AGENDA_DATABASE_URL" \
pnpm migrate:agenda-to-service

# 3. Déployer dispensary (migrate deploy droppe les tables agenda locales)
```

## Migration depuis l’ancien déploiement mono-app (users → auth)

**Ordre critique** — à exécuter **une fois**, avant que dispensary n’applique `remove_local_auth_tables` :

```bash
# 1. Créer la BDD auth et appliquer les migrations auth (tables vides)
#    → déployer le conteneur auth OU prisma migrate deploy sur AUTH_DATABASE_URL

# 2. Copier les comptes (préserve les IDs — indispensable pour dispensary_member, etc.)
SOURCE_DATABASE_URL="$DISPENSARY_DATABASE_URL" \
AUTH_DATABASE_URL="$AUTH_DATABASE_URL" \
pnpm migrate:users-to-auth

# 3. Déployer dispensary (migrate deploy supprime user/account locaux)
# 4. Mettre à jour Discord : callback sur le domaine auth
```

Si des comptes test ont déjà été créés dans la BDD auth, relancer avec `--reset-auth` :

```bash
pnpm migrate:users-to-auth -- --reset-auth
```

Résumé :

1. Migrations auth sur `AUTH_DATABASE_URL` (schéma vide)
2. `pnpm migrate:users-to-auth` avec source = ancienne BDD dispensary (encore avec tables `user`)
3. Déployer **auth**, puis **dispensary**
4. Discord redirect URI → domaine auth

## Notes

- Les migrations Prisma s’exécutent au **démarrage** du conteneur (`docker/docker-entrypoint.sh`), pas au build — pas besoin d’accès DB pendant `docker build`.
- Au runtime : image **standalone** Next.js (`node apps/<app>/server.js`) — `node_modules` tracés, build **webpack** (pas turbopack).
- Migrations via `prisma` CLI global dans l’image.
- **Important** : les variables `NEXT_PUBLIC_*` sont **inlinées au build** (logout, login client, etc.). Les mettre dans `docker-compose.yml` `environment:` seul ne suffit pas — il faut rebuild après changement d’URL (`build.args` dans compose).
- `DATABASE_URL` factice est utilisée uniquement pour `prisma generate` pendant le build.
- Pour le dev local, continuez avec `pnpm dev` (pas Docker).
