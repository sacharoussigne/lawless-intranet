# Environnement de dev local

`pnpm dev` ne lance plus tout en `next dev`. Pour économiser la RAM, seuls les **fronts** tournent en mode dev ; les **services d'API** tournent en **build de production**. `turbo watch` surveille les fichiers : quand le code d'un service change, il le reconstruit et le relance tout seul.

| App | Mode dans `pnpm dev` | Recharge à chaud |
|---|---|---|
| `dispensary` (3000), `shelter` (3006) | `next dev` | oui (HMR) |
| `realtime` (3007 / 3008) | `tsx watch` | oui (redémarre seul) |
| `auth` (3001), `documents` (3002), `agenda` (3003), `bank` (3004), `inventory` (3005), `media` (3009) | `next build` puis `next start` | rebuild + redémarrage automatiques (15 à 60 s), pas de HMR |

Pourquoi : un `next dev` garde compilateur, caches et HMR en mémoire, un `next start` beaucoup moins. Les services changent rarement. La prod n'est pas concernée. Mesuré (empreinte physique, toutes les routes des services appelées une fois) : les 6 services passent de 7,1 Go à environ 0,6 Go, le total de 11,8 Go à 5,3 Go. Le reste vient surtout des fronts en `next dev` (dispensary environ 3,4 Go, shelter environ 1,2 Go, et ils grossissent à mesure qu'on visite des pages) : `pnpm dev:dispensary` (environ 4,2 Go) ou `pnpm dev:shelter` évite de lancer celui dont on n'a pas besoin.

## Commandes

| Commande | Ce qu'elle lance |
|---|---|
| `pnpm dev` | les 2 fronts en dev, les 6 services en build, realtime |
| `pnpm dev:dispensary` | dispensary + realtime + les 6 services |
| `pnpm dev:shelter` | shelter + realtime + auth, documents, bank, media (le refuge n'utilise pas agenda ni inventory) |
| `pnpm dev:full` | l'ancien comportement : **tout** en `next dev` (plus lourd). À utiliser quand on travaille sur un service et qu'on veut le rechargement à chaud |

Les trois premières lancent `turbo watch dev:local` ; `dev:full` lance `turbo dev`. Pour un service, `dev:local` dépend de `build` et est marquée `interruptible` (`apps/<service>/turbo.json`) : au démarrage, turbo reconstruit le service si besoin puis lance `next start` ; ensuite, quand un fichier du service (ou d'un package qu'il utilise, ou son `.env`) change, `turbo watch` arrête le service, le reconstruit et le relance. Les fronts et realtime ne sont jamais relancés : ils ont leur propre rechargement.

## J'ai modifié… que faire ?

| Modification | Action |
|---|---|
| Code d'un front (`apps/dispensary/**`, `apps/shelter/**`) | rien, HMR |
| Package utilisé seulement par les fronts (`packages/*-ui`, `host-kit`…) | rien, HMR |
| `apps/realtime/**` | rien, `tsx watch` redémarre |
| Code d'un service (`apps/agenda/src/**`, `apps/auth/**`…) | rien : `turbo watch` reconstruit **ce service seulement** et le relance (15 à 60 s, regarder la ligne `<service>:dev:local: ✓ Ready`). Pour enchaîner beaucoup de modifications sur un service avec le rechargement à chaud : `pnpm dev:full` |
| Package partagé utilisé par un service (`packages/service-kit`, `*-client`, `types`, `realtime`…) | rien : les services qui en dépendent sont reconstruits et relancés (tous les 6 si c'est un package commun, donc plus long) |
| `.env` d'un service | rien : le `.env` fait partie des entrées du build, le service est reconstruit |
| `prisma/schema.prisma` d'un service | `pnpm --filter <app> db:migrate` (le service est reconstruit ensuite) |
| Après un pull ou un merge | `pnpm install`, `pnpm db:migrate:deploy`, puis `pnpm dev` |
| Build d'un service douteux (comportement ancien, erreur bizarre) | forcer le rebuild : `pnpm turbo run build --filter=<app> --force`, puis `pnpm dev`. En dernier recours : `pnpm clean:next` puis `pnpm dev` |

Pour savoir ce qui a été reconstruit, regarder les lignes `<service>:build` de turbo : `cache hit, replaying logs` = service inchangé, restauré du cache en quelques secondes ; `cache miss, executing` = service reconstruit. Le premier `pnpm dev` reconstruit les 6 services (environ une minute, et plus de mémoire le temps des builds).

**Pour les sessions Claude** : après avoir modifié un service, un package qu'il utilise ou son `.env`, `pnpm dev` le reconstruit et le relance tout seul, mais **pas instantanément** (15 à 60 s) et sans HMR. Le signaler à l'utilisateur (« attendre `<service>:dev:local: ✓ Ready` »). Si le build du service échoue (erreur de type…), le service reste arrêté : corriger l'erreur, le watch relance le build. Après un `schema.prisma`, lancer `pnpm --filter <app> db:migrate`.

## `LAWLESS_LOCAL=1`

Les scripts `dev:local` des services posent `LAWLESS_LOCAL=1` : « build de production sur un poste de dev ». Il change deux choses :
- **temps réel** (`packages/realtime/src/devDefaults.ts`) : les valeurs par défaut de dev (`localhost:3008`, secret de dev) restent actives malgré `NODE_ENV=production`. Sans ça, agenda et media ne publieraient plus rien ;
- **auth** (`apps/auth/src/lib/auth.ts`) : rate limiting de Better Auth désactivé. En local toutes les requêtes viennent de la même IP, et la limite de prod (3 connexions / 10 s) bloquerait.

**Ne jamais le poser en production** (il n'apparaît dans aucun Dockerfile ni dans `docker-compose.yml`).

## Pièges

- Les variables `NEXT_PUBLIC_*` d'auth sont figées au build : les changer dans `apps/auth/.env` déclenche le rebuild d'auth (automatique avec `pnpm dev`).
- L'avertissement `"next start" does not work with "output: standalone"` au démarrage des services est attendu : ça fonctionne.
- Un service en build n'affiche pas d'erreur de compilation à chaud : une erreur de type ou de syntaxe fait échouer son `build` (log `<service>:build`), et le service reste arrêté jusqu'à la correction.
- Une modification d'un package commun à tous les services relance les 6 builds en parallèle : pic de CPU et de RAM pendant une minute.
- Mêmes ports qu'avant : ne pas lancer `pnpm dev` et `pnpm dev:full` en même temps.
