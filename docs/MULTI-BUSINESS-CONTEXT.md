# Chantier multi-entreprises : contexte pour reprendre

Fiche de reprise du chantier « app business » (dispensaires, general stores, puis saloons…). La réflexion complète et le détail de chaque phase sont dans [`MULTI-BUSINESS.md`](MULTI-BUSINESS.md). Les URLs de dev et de prod sont dans [`URLS.md`](URLS.md).

## Où on en est (20/10/2026)

| Phase | Contenu | État |
|---|---|---|
| 0 | Réflexion (`MULTI-BUSINESS.md`) | ✅ |
| 1 | Renommage interne `Dispensary` → `Business` (Prisma `@@map`, tables inchangées) | ✅ |
| 2 | `Business.type` et registre `lib/businessTypes` (modules, rôles et permissions par défaut, compteurs) | ✅ |
| 3 | Activité hebdo générique (compteurs JSON par type, permission `weekly_activity`) | ✅ |
| 4 | Personnes communes (`Person` + `BusinessPerson`) | ✅ |
| 5 | Routage : URLs `/<slug>/…`, hôte → type (`BUSINESS_TYPE_HOSTS`), page de choix / d'accueil, SSO multi-hôtes | ✅ |
| 6 | Services en `scopeType: 'business'` | ✅ |
| 7 | General store | ⏸️ **pas fait pour l'instant** (spec gardée ci-dessous) |
| 8 | Renommage final (`apps/business`), libellés génériques ; multi-domaines reporté | ✅ |

- **Livraison :** les phases 1 à 6 sont dans `dev` (PR #80, squash) et **en prod** sur l'ancien domaine `dispensaire.aerokusu.fr`, sans `BUSINESS_TYPE_HOSTS` (pas de routage par hôte).
- **Branche :** le chantier continue sur `feat(business)/rename-dispensary-to-business`. Elle est remise à niveau de `dev` (merge) avant chaque reprise.

## Façon de travailler sur ce chantier

- **Une phase, un commit** sur la branche du chantier, **après le test de l'utilisateur**. Pas de PR ni de push sans demande explicite (« ne me pose plus la question »).
- **Les petites corrections hors chantier** se font directement sur `dev` (un commit), puis on fusionne `dev` dans la branche. Les conflits de chemins renommés se règlent en gardant la version de `dev`, et on vérifie après coup que `git diff dev` est vide si rien d'autre n'a bougé.
- **Migrations de données :**
  - relever des totaux de contrôle avant et après (script `q.cjs` qui lit `DATABASE_URL` sans l'afficher) ;
  - **ne jamais lire de `.env` réel** (règle de l'utilisateur) ;
  - avant un déploiement avec migrations, sauvegarder la prod avec `pnpm db:pull-prod --dump-only --yes` (vers `.db-dumps/<date>/`, en lecture seule).
- **Plan d'abord pour les gros morceaux :** phase 8 (et la phase 7 si elle est reprise).

## Pièges connus

- **Dev multi-hôtes :** il faut `*.lawless.localhost`. Un cookie `Domain=.localhost` est refusé par les navigateurs (`localhost` compte comme une extension de premier niveau), ce qui donne un `state_mismatch` au login Discord.
  - Auth : `AUTH_COOKIE_DOMAIN=.lawless.localhost`, URLs `auth.lawless.localhost:3001`.
  - Les configs Next ont `allowedDevOrigins` (sinon la page ne s'hydrate pas).
  - Voir `docs/SSO-DEV.md` et les `.env.example`.
- **Appels internes en prod :** Cloudflare est devant tous les domaines. Les appels de serveur à serveur passent par le **réseau Docker `internal`** (`http://auth:3001`, `http://bank:3004`…), jamais par les URLs publiques. Via Cloudflare, ils prenaient 40 à 640 ms au lieu de 3 à 5 ms (`docs/DOCKER.md` › « Appels entre conteneurs »).
- **Noms d'URL réservés :** les pages d'une entreprise sont à `/<slug>/…`. Les segments de l'app (`api`, `auth`, `platform`, `settings`, `admin`, `partage`, `d`, `test` et les anciens chemins) sont des slugs interdits (`lib/business/slug.ts`).
- **Compatibilité à garder :**
  - API des bots (`/api/dispensary/...`, `x-dispensary-id`, champs `patientsCount`…) ;
  - redirections `/d/<slug>/…` ;
  - préfixe S3 `dispensary/<id>/` des anciens fichiers (purgé avec le scope).
- **Invariants :**
  - ne jamais renommer une clé de compteur (en base et dans l'historique) ;
  - les tables gardent leurs noms `dispensary_*` (`@@map`), ce qui est voulu.

## Carte du code

| Sujet | Où |
|---|---|
| Registre des types (libellés, modules, rôles, matrice, compteurs, signal d'horaires, statistiques de paie) | `apps/business/src/lib/businessTypes/index.ts` (l'app est `apps/business`, ex-`apps/dispensary`) |
| Modules et réglages (un module coupé si non proposé par le type) | `lib/appFeatures.ts`, `lib/appSettingsShared.ts` (`normalizeAppSettings`) |
| Compteurs d'activité hebdo | `lib/businessWeeklyActivity/counters.ts`, `fieldVisibility.ts`, `botApiRow.ts` |
| Personnes (lecture sans Prisma à l'exécution / écritures) | `lib/businessDiscordProfile/queries.ts`, `service.ts` |
| Hôtes, slugs, sélecteur | `lib/business/hosts.ts`, `slug.ts`, `switcher.ts`, `accessibleBusinesses.ts` |
| Racine, page de choix et page d'accueil | `app/page.tsx`, `app/_components/BusinessPicker` |
| Scope des services | `lib/serviceHost.ts` (`scopeType: 'business'`) |
| Prod (variables, hôtes, réseau interne) | `docker/.env.example`, `docker-compose.yml`, `docs/DOCKER.md` |

## Phase 7 : ce qui est décidé (en pause)

> **On ne fait pas le general store pour l'instant** (décision du 21/10/2026). La spec reste là pour le jour où on le reprendra. En attendant, il n'y a qu'un type, `DISPENSARY`, et aucun hôte `gs`.

- **Type `GENERAL_STORE` :**
  - ajouter la valeur à l'enum Prisma (migration `ALTER TYPE … ADD VALUE`) et l'entrée dans le registre ;
  - libellé « General store », hôte `gs` (`BUSINESS_TYPE_HOSTS=…,GENERAL_STORE=gs…`).
- **Modules :** tous ceux du dispensaire **sauf** `cabinet`, plus le nouveau **catalogue de prix** :
  - réservé aux employés connectés, permission `price_catalog:view`, sans page publique ;
  - alimenté par le champ `price` des objets de l'inventaire ;
  - à trancher : un réglage « visible au catalogue » par objet.
- **Rôles :** admin + **employé**. La matrice exacte de l'employé est à définir.
- **Activité hebdo :**
  - caisse et présence ;
  - plus les compteurs `food` « Nourriture » et `drink` « Boisson » (consommation personnelle, icônes `food` / `drink` déjà prévues), sans statistique de paie ;
  - chacun désactivable dans les réglages.
- **Thème bleu** (clair et sombre) sur le moteur `host-kit/theme`, avec un logo et un titre propres au type.
  - La préférence de thème devient une valeur **par type** (`UserUiPreferences.theme`).
  - Le dispensaire reste vert.
- **Création :** choix du type dans `/platform/dispensaries` (création d'une entreprise).
- **Encore ouvert :** d'autres modules propres au general store.
