# Déploiement Docker (monorepo)

Une image par app (`auth`, `business`, `shelter`, `documents`, `agenda`, `bank`, `inventory`, `media`, `realtime`), construite depuis la **racine du monorepo** pour inclure automatiquement les packages workspace (`@lawless-intranet/*`).

Les apps Next.js utilisent le `Dockerfile` racine ; le serveur WebSocket `realtime` (Node pur, sans Prisma) a son propre `docker/realtime.Dockerfile` (voir [Serveur temps réel](#serveur-temps-réel-websocket)).

## Principe

```
docker build (context: .)
    │
    ├─ turbo prune auth|business|shelter|documents|agenda|bank|inventory|media --docker   → apps + packages nécessaires
    ├─ pnpm install
    ├─ pnpm turbo build --filter=<app>        → next build --webpack + standalone
    └─ entrypoint: prisma migrate deploy + node apps/<app>/server.js
```

## Prérequis

- Docker + Docker Compose
- Réseau `proxy` externe (nginx-proxy / letsencrypt-companion), comme avant
- Un enregistrement DNS pour `REALTIME_VIRTUAL_HOST` (ex. `realtime.example.com`), couvert par `AUTH_COOKIE_DOMAIN`
- Huit bases PostgreSQL (auth + business + shelter + documents + agenda + bank + inventory + media)
- Un bucket S3 pour la médiathèque, avec son CORS et un utilisateur IAM (voir [docs/MEDIA.md](MEDIA.md))
- Discord redirect URI : `https://<AUTH_VIRTUAL_HOST>/api/auth/callback/discord`

## Démarrage rapide

```bash
cp docker/.env.example .env.docker
# Éditer .env.docker (URLs, DB, secrets, VIRTUAL_HOST)

docker compose --env-file .env.docker up -d --build
```

## Workflow de déploiement (prod)

> **App renommée `business` (ex-`dispensary`)** : le service compose, l'image et le conteneur s'appellent maintenant `business` (`<projet>-business`). Les variables d'env gardent leurs noms `DISPENSARY_*`, donc le `.env.docker` ne change pas. Au premier déploiement après ce renommage, `make deploy` (qui fait `docker compose up -d --build --remove-orphans`) crée `business` et **supprime l'ancien conteneur `dispensary`**. Sans `--remove-orphans`, l'ancien conteneur resterait derrière le même `VIRTUAL_HOST` et nginx-proxy alternerait entre les deux.

Après un `git pull`, **ne pas** utiliser `make rebuild` en routine — cette commande force un rebuild sans cache des 7 apps et remplit rapidement le disque.

| Situation | Commande |
|-----------|----------|
| Déploiement normal | `make deploy` |
| Une seule app modifiée | `make service SERVICE=business` |
| Package partagé (`packages/*`) | `make deploy` |
| Cache Docker suspect / build incohérent | `make rebuild` (dépannage uniquement) |
| Après builds ratés ou disque plein | `make docker-prune` |

`make deploy` exécute `docker compose up -d --build` : Docker réutilise les couches inchangées (deps, lockfile, etc.) et ne reconstruit que ce qui a changé.

Services disponibles pour `make service SERVICE=…` : `auth`, `business`, `documents`, `agenda`, `bank`, `inventory`, `shelter`, `media`, `realtime`.

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

# Business, ex-dispensary (port 3000)
docker build \
  --build-arg APP_NAME=business \
  --build-arg APP_PORT=3000 \
  -t lawless-business .

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
| `DISPENSARY_PUBLIC_URL` | auth + business | URL **principale** de l'app business (toutes les entreprises) — **build + runtime** (`NEXT_PUBLIC_APP_URL`) |
| `DISPENSARY_VIRTUAL_HOST` | business + auth | Hôte(s) nginx-proxy / letsencrypt, liste séparée par des virgules (voir « Plusieurs hôtes ») |
| `DISPENSARY_EXTRA_PUBLIC_URLS` | realtime | Autres URLs publiques de l'app business (origines websocket acceptées) |
| `BUSINESS_TYPE_HOSTS` | business | Hôte de chaque type d'entreprise (`DISPENSARY=dispensaire.example.com,…`), lu au runtime |
| `FOLLOW_UP_CRON_SECRET` | shelter | Protège la route cron des relances de suivi |
| `SHELTER_PUBLIC_URL` | auth + shelter | URL publique refuge — **build + runtime** (`NEXT_PUBLIC_APP_URL`) |
| `DOCUMENTS_PUBLIC_URL` | documents + business | URL service documents (`DOCUMENTS_URL` côté business) |
| `AGENDA_PUBLIC_URL` | agenda + business | URL service agenda (`AGENDA_URL` côté business) |
| `BANK_PUBLIC_URL` | bank + business + shelter | URL service banque (`BANK_URL`) |
| `INVENTORY_PUBLIC_URL` | inventory + business | URL service inventaire (`INVENTORY_URL` côté business) |
| `AUTH_COOKIE_DOMAIN` | auth | Domaine cookie SSO (ex. `.example.com`). Cookie name prefix is `lawless-intranet` (not `better-auth`) to avoid collisions with other apps on the same domain. |
| `AUTH_DATABASE_URL` | auth | DB auth |
| `DISPENSARY_DATABASE_URL` | business | DB métier |
| `SHELTER_DATABASE_URL` | shelter | DB refuge |
| `DOCUMENTS_DATABASE_URL` | documents | DB documents/templates |
| `AGENDA_DATABASE_URL` | agenda | DB agendas/events/todos |
| `BANK_DATABASE_URL` | bank | DB ledger bancaire |
| `INVENTORY_DATABASE_URL` | inventory | DB stock / commandes / ventes / entreprises |
| `MEDIA_DATABASE_URL` | media | DB médiathèque (dossiers, fichiers) |
| `AUTH_INTERNAL_SECRET` | auth + hosts | API interne service-to-service |
| `AGENDA_INTERNAL_SECRET` | agenda + business | Secret host→agenda pour ops `scopeAdmin` / create |
| `BANK_INTERNAL_SECRET` | bank + business + shelter | Secret host→bank (purge-scope) |
| `BANK_BOT_API_SECRET` | bank + business | Secret bot materialize-planned |
| `INVENTORY_INTERNAL_SECRET` | inventory + business | Secret host→inventory (purge-scope) |
| `DOCUMENTS_INTERNAL_SECRET` | documents + business | Secret host→documents (toutes les routes API sauf health) |
| `REALTIME_PUBLIC_URL` | business | URL WebSocket navigateur (`wss://realtime.example.com`), lue **au runtime** (pas de rebuild) |
| `REALTIME_VIRTUAL_HOST` | realtime | Hôte nginx-proxy du WebSocket |
| `REALTIME_TOKEN_SECRET` | realtime + business | Signature des jetons d'abonnement (business signe, realtime vérifie) |
| `REALTIME_INTERNAL_SECRET` | realtime + agenda | Publication service→realtime sur le port interne |
| `MEDIA_INTERNAL_SECRET` | media + shelter + business | Secret hôte→media (toutes les routes) |
| `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION` | media | Bucket S3 de la médiathèque |
| `MEDIA_AWS_ACCESS_KEY_ID`, `MEDIA_AWS_SECRET_ACCESS_KEY` | media | Clés de l'utilisateur IAM du bucket |

## Appels entre conteneurs (réseau `internal`)

Les appels de serveur à serveur passent par le réseau Docker privé `internal` :
- business et shelter vers auth, documents, agenda, bank, inventory ;
- les services vers auth, pour lire la session.

On utilise `http://auth:3001`, `http://bank:3004`… plutôt que les URLs publiques. Une page en fait plusieurs, et chacun évite ainsi une résolution DNS publique, l'aller-retour par nginx-proxy et une négociation TLS.

- Les `*_PUBLIC_URL` ne servent plus qu'au navigateur (`NEXT_PUBLIC_*`), à `VIRTUAL_HOST` et aux origines de confiance.
- `internal` est un réseau `internal: true` : on ne sort pas par lui. L'accès sortant (Discord, S3) reste assuré par les autres réseaux.
- `UV_THREADPOOL_SIZE=16` sur les conteneurs Node. Les résolutions DNS, les lectures de fichiers (fichiers statiques compris), zlib et la crypto partagent un pool de 4 threads par défaut, et quelques appels lents suffisaient à faire attendre tout le reste.

## Plusieurs hôtes (app business)

L'app business (aujourd'hui `apps/business`) sert **un seul conteneur sur plusieurs hôtes** (`docs/MULTI-BUSINESS.md`) :

| Hôte | Rôle |
|---|---|
| `business.example.com` | URL principale : toutes les entreprises de l'utilisateur, page de choix |
| `dispensaire.example.com` | Dispensaires uniquement |
| `gs.example.com` | General stores uniquement (phase 7) |

Dans `.env.docker` :

```env
DISPENSARY_PUBLIC_URL=https://business.example.com
DISPENSARY_VIRTUAL_HOST=business.example.com,dispensaire.example.com,gs.example.com
DISPENSARY_EXTRA_PUBLIC_URLS=https://dispensaire.example.com,https://gs.example.com
BUSINESS_TYPE_HOSTS=DISPENSARY=dispensaire.example.com
AUTH_COOKIE_DOMAIN=.example.com
```

- **DNS** : un enregistrement par hôte vers le serveur. nginx-proxy route la liste `VIRTUAL_HOST` vers le conteneur, et le compagnon letsencrypt émet un certificat pour chaque nom de `LETSENCRYPT_HOST`.
- **SSO** : un seul cookie sur `AUTH_COOKIE_DOMAIN`. Auth accepte les hôtes de `DISPENSARY_VIRTUAL_HOST` et tout sous-domaine du cookie, et la connexion revient sur l'hôte d'origine.
- **Realtime** : `ALLOWED_ORIGINS` = URL principale + `DISPENSARY_EXTRA_PUBLIC_URLS` + refuge (compose).
- **Migration depuis `dispensaire.example.com` seul** : garder ce domaine dans la liste et dans `BUSINESS_TYPE_HOSTS` ; les liens existants continuent de marcher (les anciens chemins `/d/<slug>/…` redirigent).
- Les services (documents, agenda, bank, inventory) ne sont appelés que de serveur à serveur : leur CORS n'a pas besoin des autres hôtes.
- Sans `BUSINESS_TYPE_HOSTS`, aucun routage par hôte : tout hôte se comporte comme l'URL principale.

## Serveur temps réel (WebSocket)

`apps/realtime` est un serveur Node + `ws` (bundle esbuild, image `docker/realtime.Dockerfile`). Tout le temps réel des apps passe par lui (il n'y a plus de SSE).

```
navigateur ──wss://REALTIME_VIRTUAL_HOST──▶ nginx-proxy ──▶ realtime:3007   (WebSocket, seul port routé)
agenda, media, business, shelter ──http://realtime:3008/publish (réseau privé « realtime »)──▶ realtime:3008
```

- **Port 3007** : WebSocket navigateur. Contrôle de l'`Origin` (`ALLOWED_ORIGINS`), puis authentification par un jeton court signé par l'app hôte, business ou shelter (`REALTIME_TOKEN_SECRET`), qui liste les topics autorisés (`agenda:<id>`, `orders:<id>`, `sales:<id>`, `waitlist:<id>`, `user:<id>`…, voir `packages/realtime/src/topics.ts`).
- **Port 3008** : API interne (`/publish`, `/revoke`, `/health`), joignable uniquement sur le réseau Docker privé `realtime` (`internal: true`) et protégée par `REALTIME_INTERNAL_SECRET`. nginx ne la route pas et aucun port n'est publié sur l'hôte.
- Ping toutes les 25 s (sous le `proxy_read_timeout` de 60 s de nginx-proxy) ; nginx-proxy gère l'upgrade WebSocket par défaut.
- Une seule instance (hub en mémoire). Si le serveur redémarre, les clients se reconnectent et rechargent leurs données.

```bash
make service SERVICE=realtime          # build + (re)déploiement du seul serveur temps réel
docker logs lawless-realtime           # « [realtime] websocket on :3007, internal API on :3008 »
```

## Migration bank depuis l’ancien stockage business

**Ordre critique** — à exécuter **une fois**, avant que business n’applique `extract_bank_to_service` :

```bash
# 1. Créer la BDD bank et appliquer les migrations (tables vides)
#    → déployer le conteneur bank OU prisma migrate deploy sur BANK_DATABASE_URL

# 2. Copier les données (préserve les UUIDs)
DISPENSARY_DATABASE_URL="$DISPENSARY_DATABASE_URL" \
BANK_DATABASE_URL="$BANK_DATABASE_URL" \
pnpm migrate:bank-to-service

# 3. Déployer business (migrate deploy droppe les tables bank locales)
```

## Migration agenda depuis l’ancien stockage business

**Ordre critique** — à exécuter **une fois**, avant que business n’applique `remove_agenda_tables` :

```bash
# 1. Créer la BDD agenda et appliquer les migrations (tables vides)
#    → déployer le conteneur agenda OU prisma migrate deploy sur AGENDA_DATABASE_URL

# 2. Copier les données (préserve les UUIDs)
DISPENSARY_DATABASE_URL="$DISPENSARY_DATABASE_URL" \
AGENDA_DATABASE_URL="$AGENDA_DATABASE_URL" \
pnpm migrate:agenda-to-service

# 3. Déployer business (migrate deploy droppe les tables agenda locales)
```

## Migration inventory depuis l’ancien stockage business

**Ordre critique** — à exécuter **une fois**, avant que business n’applique `remove_inventory_tables` :

```bash
# 1. Créer la BDD inventory et appliquer les migrations (tables vides)
#    → déployer le conteneur inventory OU prisma migrate deploy sur INVENTORY_DATABASE_URL

# 2. Copier les données (préserve les UUIDs)
DISPENSARY_DATABASE_URL="$DISPENSARY_DATABASE_URL" \
INVENTORY_DATABASE_URL="$INVENTORY_DATABASE_URL" \
pnpm migrate:inventory-to-service

# 3. Déployer business (migrate deploy droppe les tables inventaire locales)
```

## Migration depuis l’ancien déploiement mono-app (users → auth)

**Ordre critique** — à exécuter **une fois**, avant que business n’applique `remove_local_auth_tables` :

```bash
# 1. Créer la BDD auth et appliquer les migrations auth (tables vides)
#    → déployer le conteneur auth OU prisma migrate deploy sur AUTH_DATABASE_URL

# 2. Copier les comptes (préserve les IDs — indispensable pour dispensary_member, etc.)
SOURCE_DATABASE_URL="$DISPENSARY_DATABASE_URL" \
AUTH_DATABASE_URL="$AUTH_DATABASE_URL" \
pnpm migrate:users-to-auth

# 3. Déployer business (migrate deploy supprime user/account locaux)
# 4. Mettre à jour Discord : callback sur le domaine auth
```

Si des comptes test ont déjà été créés dans la BDD auth, relancer avec `--reset-auth` :

```bash
pnpm migrate:users-to-auth -- --reset-auth
```

Résumé :

1. Migrations auth sur `AUTH_DATABASE_URL` (schéma vide)
2. `pnpm migrate:users-to-auth` avec source = ancienne BDD business (encore avec tables `user`)
3. Déployer **auth**, puis **business**
4. Discord redirect URI → domaine auth

## Notes

- Les migrations Prisma s’exécutent au **démarrage** du conteneur (`docker/docker-entrypoint.sh`), pas au build — pas besoin d’accès DB pendant `docker build`.
- Au runtime : image **standalone** Next.js (`node apps/<app>/server.js`) — `node_modules` tracés, build **webpack** (pas turbopack). Exception : `realtime` tourne en `node server.mjs` (bundle unique).
- Migrations via `prisma` CLI global dans l’image.
- **Important** : les variables `NEXT_PUBLIC_*` sont **inlinées au build** (logout, login client, etc.). Les mettre dans `docker-compose.yml` `environment:` seul ne suffit pas — il faut rebuild après changement d’URL (`build.args` dans compose).
- `DATABASE_URL` factice est utilisée uniquement pour `prisma generate` pendant le build.
- Pour le dev local, continuez avec `pnpm dev` (pas Docker).
- Le Dockerfile utilise un **cache mount BuildKit** pour le store pnpm (`/pnpm/store`) : les paquets déjà téléchargés sont réutilisés entre builds, y compris lors de rebuilds successifs de plusieurs apps.
