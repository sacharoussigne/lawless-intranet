# Déploiement Docker (monorepo)

Une image par app (`auth`, `dispensary`, `shelter`, `documents`, `agenda`, `bank`, `inventory`, `media`, `realtime`), construite depuis la **racine du monorepo** pour inclure automatiquement les packages workspace (`@lawless-intranet/*`).

Les apps Next.js utilisent le `Dockerfile` racine ; le serveur WebSocket `realtime` (Node pur, sans Prisma) a son propre `docker/realtime.Dockerfile` (voir [Serveur temps réel](#serveur-temps-réel-websocket)).

## Principe

```
docker build (context: .)
    │
    ├─ turbo prune auth|dispensary|shelter|documents|agenda|bank|inventory|media --docker   → apps + packages nécessaires
    ├─ pnpm install
    ├─ pnpm turbo build --filter=<app>        → next build --webpack + standalone
    └─ entrypoint: prisma migrate deploy + node apps/<app>/server.js
```

## Prérequis

- Docker + Docker Compose
- Réseau `proxy` externe (nginx-proxy / letsencrypt-companion), comme avant
- Un enregistrement DNS pour `REALTIME_VIRTUAL_HOST` (ex. `realtime.example.com`), couvert par `AUTH_COOKIE_DOMAIN`
- Huit bases PostgreSQL (auth + dispensary + shelter + documents + agenda + bank + inventory + media)
- Un bucket S3 pour la médiathèque, avec son CORS et un utilisateur IAM (voir [docs/MEDIA.md](MEDIA.md))
- Discord redirect URI : `https://<AUTH_VIRTUAL_HOST>/api/auth/callback/discord`

## Démarrage rapide

```bash
cp docker/.env.example .env.docker
# Éditer .env.docker (URLs, DB, secrets, VIRTUAL_HOST)

docker compose --env-file .env.docker up -d --build
```

## Workflow de déploiement (prod)

Après un `git pull`, **ne pas** utiliser `make rebuild` en routine — cette commande force un rebuild sans cache des 7 apps et remplit rapidement le disque.

| Situation | Commande |
|-----------|----------|
| Déploiement normal | `make deploy` |
| Une seule app modifiée | `make service SERVICE=dispensary` |
| Package partagé (`packages/*`) | `make deploy` |
| Cache Docker suspect / build incohérent | `make rebuild` (dépannage uniquement) |
| Après builds ratés ou disque plein | `make docker-prune` |

`make deploy` exécute `docker compose up -d --build` : Docker réutilise les couches inchangées (deps, lockfile, etc.) et ne reconstruit que ce qui a changé.

Services disponibles pour `make service SERVICE=…` : `auth`, `dispensary`, `documents`, `agenda`, `bank`, `inventory`, `shelter`, `media`, `realtime`.

## Maintenance disque

Sur un VPS avec 7 apps Next.js, prévoir **≥ 80 Go** de disque ou purger régulièrement le cache de build.

### Surveillance

```bash
make docker-df
# ou manuellement :
df -h /
docker system df
docker buildx du
```

Sur Docker Engine récent (containerd image store), l'espace est surtout dans `/var/lib/containerd`, pas dans `/var/lib/docker`.

### Nettoyage du cache BuildKit

```bash
make docker-prune
```

Si `docker system df` affiche `RECLAIMABLE 0B` malgré des dizaines de Go de Build Cache, redémarrer Docker débloque souvent BuildKit :

```bash
systemctl restart docker
docker ps                    # vérifier que les conteneurs sont repartis
docker buildx prune -a -f
df -h /
```

**Ne jamais** supprimer manuellement `/var/lib/containerd` — les images et conteneurs actifs y sont stockés.

### Nettoyage initial (avant le premier déploiement optimisé)

À exécuter une fois sur le serveur si le disque est saturé :

```bash
df -h /
docker system df
du -h --max-depth=1 /var/lib/containerd 2>/dev/null | sort -hr

systemctl restart docker
docker ps

docker buildx prune -a -f

df -h /
docker system df
```

### Cron optionnel (serveur)

```bash
# /etc/cron.weekly/docker-prune
docker buildx prune -a -f --filter "until=168h"
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

# Bank (port 3004)
docker build \
  --build-arg APP_NAME=bank \
  --build-arg APP_PORT=3004 \
  -t lawless-bank .

# Inventory (port 3005)
docker build \
  --build-arg APP_NAME=inventory \
  --build-arg APP_PORT=3005 \
  -t lawless-inventory .

# Shelter (port 3006)
docker build \
  --build-arg APP_NAME=shelter \
  --build-arg APP_PORT=3006 \
  -t lawless-shelter .
```

## Variables importantes en prod

| Variable | App | Rôle |
|----------|-----|------|
| `AUTH_PUBLIC_URL` | auth + hosts | URL publique IdP — **build + runtime** (`NEXT_PUBLIC_AUTH_URL`) |
| `DISPENSARY_PUBLIC_URL` | auth + dispensary | URL publique RP — **build + runtime** (`NEXT_PUBLIC_APP_URL`) |
| `SHELTER_PUBLIC_URL` | auth + shelter | URL publique refuge — **build + runtime** (`NEXT_PUBLIC_APP_URL`) |
| `DOCUMENTS_PUBLIC_URL` | documents + dispensary | URL service documents (`DOCUMENTS_URL` côté dispensary) |
| `AGENDA_PUBLIC_URL` | agenda + dispensary | URL service agenda (`AGENDA_URL` côté dispensary) |
| `BANK_PUBLIC_URL` | bank + dispensary + shelter | URL service banque (`BANK_URL`) |
| `INVENTORY_PUBLIC_URL` | inventory + dispensary | URL service inventaire (`INVENTORY_URL` côté dispensary) |
| `AUTH_COOKIE_DOMAIN` | auth | Domaine cookie SSO (ex. `.example.com`). Cookie name prefix is `lawless-intranet` (not `better-auth`) to avoid collisions with other apps on the same domain. |
| `AUTH_DATABASE_URL` | auth | DB auth |
| `DISPENSARY_DATABASE_URL` | dispensary | DB métier |
| `SHELTER_DATABASE_URL` | shelter | DB refuge |
| `DOCUMENTS_DATABASE_URL` | documents | DB documents/templates |
| `AGENDA_DATABASE_URL` | agenda | DB agendas/events/todos |
| `BANK_DATABASE_URL` | bank | DB ledger bancaire |
| `INVENTORY_DATABASE_URL` | inventory | DB stock / commandes / ventes / entreprises |
| `MEDIA_DATABASE_URL` | media | DB médiathèque (dossiers, fichiers) |
| `AUTH_INTERNAL_SECRET` | auth + hosts | API interne service-to-service |
| `AGENDA_INTERNAL_SECRET` | agenda + dispensary | Secret host→agenda pour ops `scopeAdmin` / create |
| `BANK_INTERNAL_SECRET` | bank + dispensary + shelter | Secret host→bank (purge-scope) |
| `BANK_BOT_API_SECRET` | bank + dispensary | Secret bot materialize-planned |
| `INVENTORY_INTERNAL_SECRET` | inventory + dispensary | Secret host→inventory (purge-scope) |
| `DOCUMENTS_INTERNAL_SECRET` | documents + dispensary | Secret host→documents (toutes les routes API sauf health) |
| `REALTIME_PUBLIC_URL` | dispensary | URL WebSocket navigateur (`wss://realtime.example.com`), lue **au runtime** (pas de rebuild) |
| `REALTIME_VIRTUAL_HOST` | realtime | Hôte nginx-proxy du WebSocket |
| `REALTIME_TOKEN_SECRET` | realtime + dispensary | Signature des jetons d'abonnement (dispensary signe, realtime vérifie) |
| `REALTIME_INTERNAL_SECRET` | realtime + agenda | Publication service→realtime sur le port interne |
| `MEDIA_INTERNAL_SECRET` | media + shelter | Secret hôte→media (toutes les routes) |
| `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION` | media | Bucket S3 de la médiathèque |
| `MEDIA_AWS_ACCESS_KEY_ID`, `MEDIA_AWS_SECRET_ACCESS_KEY` | media | Clés de l'utilisateur IAM du bucket |

## Serveur temps réel (WebSocket)

`apps/realtime` est un serveur Node + `ws` (bundle esbuild, image `docker/realtime.Dockerfile`). Il remplace progressivement les flux SSE ; l'agenda, les todos et la médiathèque passent déjà par lui.

```
navigateur ──wss://REALTIME_VIRTUAL_HOST──▶ nginx-proxy ──▶ realtime:3007   (WebSocket, seul port routé)
agenda, media ──http://realtime:3008/publish (réseau privé « realtime »)──▶ realtime:3008
```

- **Port 3007** : WebSocket navigateur. Contrôle de l'`Origin` (`ALLOWED_ORIGINS`), puis authentification par un jeton court signé par le dispensary (`REALTIME_TOKEN_SECRET`) qui liste les topics autorisés (`agenda:<id>`, `agendas:<scope>`, `user:<id>`).
- **Port 3008** : API interne (`/publish`, `/revoke`, `/health`), joignable uniquement sur le réseau Docker privé `realtime` (`internal: true`) et protégée par `REALTIME_INTERNAL_SECRET`. nginx ne la route pas et aucun port n'est publié sur l'hôte.
- Ping toutes les 25 s (sous le `proxy_read_timeout` de 60 s de nginx-proxy) ; nginx-proxy gère l'upgrade WebSocket par défaut.
- Une seule instance (hub en mémoire). Si le serveur redémarre, les clients se reconnectent et rechargent leurs données.

```bash
make service SERVICE=realtime          # build + (re)déploiement du seul serveur temps réel
docker logs lawless-realtime           # « [realtime] websocket on :3007, internal API on :3008 »
```

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

## Migration inventory depuis l’ancien stockage dispensary

**Ordre critique** — à exécuter **une fois**, avant que dispensary n’applique `remove_inventory_tables` :

```bash
# 1. Créer la BDD inventory et appliquer les migrations (tables vides)
#    → déployer le conteneur inventory OU prisma migrate deploy sur INVENTORY_DATABASE_URL

# 2. Copier les données (préserve les UUIDs)
DISPENSARY_DATABASE_URL="$DISPENSARY_DATABASE_URL" \
INVENTORY_DATABASE_URL="$INVENTORY_DATABASE_URL" \
pnpm migrate:inventory-to-service

# 3. Déployer dispensary (migrate deploy droppe les tables inventaire locales)
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
- Au runtime : image **standalone** Next.js (`node apps/<app>/server.js`) — `node_modules` tracés, build **webpack** (pas turbopack). Exception : `realtime` tourne en `node server.mjs` (bundle unique).
- Migrations via `prisma` CLI global dans l’image.
- **Important** : les variables `NEXT_PUBLIC_*` sont **inlinées au build** (logout, login client, etc.). Les mettre dans `docker-compose.yml` `environment:` seul ne suffit pas — il faut rebuild après changement d’URL (`build.args` dans compose).
- `DATABASE_URL` factice est utilisée uniquement pour `prisma generate` pendant le build.
- Pour le dev local, continuez avec `pnpm dev` (pas Docker).
- Le Dockerfile utilise un **cache mount BuildKit** pour le store pnpm (`/pnpm/store`) : les paquets déjà téléchargés sont réutilisés entre builds, y compris lors de rebuilds successifs de plusieurs apps.
