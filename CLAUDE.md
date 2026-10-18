# CLAUDE.md

Guide pour travailler sur **lawless-intranet**.

## Concept

Intranet pour un serveur **RP western (RedM, ~1890)**. Il sert à des organisations en jeu : le **dispensaire de Saint-Denis** (stock, commandes, ventes, banque, courriers, paie, activité hebdo, agenda, cabinet) et le **refuge animalier** (animaux, espèces/races, suivis, liste d'attente, documents, banque).

- **Multi-tenant** : chaque organisation a un slug. Routes `/d/[businessSlug]/…` (dispensary) et `/s/[shelterSlug]/…` (shelter). Les espaces sont `employee/`, `management/`, `admin/` ; `platform/` sert à l'admin global.
- **Calendrier RP** : les dates sont stockées en réel et affichées **136 ans plus tôt** (`RP_DISPLAY_YEAR_OFFSET` dans `lib/rpCalendar.ts`). Ne jamais écrire de date RP en base. Côté UI, utiliser `formatRpDate`, `RpDateInput`, etc.
- **Langue** : l'UI, les messages d'erreur et les docs sont en **français**. Le code (identifiants) et les messages de commit sont en **anglais**.

## Architecture (monorepo pnpm + Turborepo)

Toutes les apps sont en Next.js 16 (App Router), React 19, Prisma 7 (`@prisma/adapter-pg`, client généré dans `src/generated/prisma`) et PostgreSQL. **Chaque app a sa propre base.**

| App | Port | Rôle |
|---|---|---|
| `apps/dispensary` | 3000 | Front du dispensaire (Mantine) |
| `apps/auth` | 3001 | Fournisseur d'identité SSO (Better Auth, Discord OAuth) |
| `apps/documents` | 3002 | API des documents et templates |
| `apps/agenda` | 3003 | API agenda et todos (publie ses changements vers `realtime`) |
| `apps/bank` | 3004 | API banque (semaines, transactions, transactions planifiées) |
| `apps/inventory` | 3005 | API inventaire |
| `apps/shelter` | 3006 | Front du refuge (Mantine) |
| `apps/media` | 3009 | API médiathèque (dossiers, fichiers dans S3), appelée uniquement par l'hôte. Voir `docs/MEDIA.md` |
| `apps/realtime` | 3007 / 3008 | Serveur WebSocket temps réel (Node + `ws`, sans Next ni base) |

Les **services** (documents, agenda, bank, inventory, media) n'exposent que des route handlers `src/app/api/**/route.ts`. Leurs données sont cloisonnées par `scopeType` / `scopeId` (par exemple le dispensaire X ou le refuge Y). Ils authentifient l'appelant de deux façons :
- le cookie de session SSO, transmis tel quel (`getSession(cookieHeader)` de `@lawless-intranet/auth-client/server`) ;
- un header de secret interne (`x-<service>-internal-secret`) pour les opérations hôte.

Packages partagés (`packages/*`, consommés en TS source via `workspace:*`, sans build) :
- `types` : DTO partagés entre les services et leurs clients.
- `*-client` (`agenda`, `bank`, `documents`, `inventory`, `media`, `auth`) : clients fetch typés vers les services. L'export `./server` est réservé au côté serveur.
- `service-client` : couche fetch commune des `*-client` (`createServiceFetch` : URL et secret depuis l'env, cookie SSO transmis, parsing JSON, `ServiceClientError`). Chaque `XClientError` en hérite.
- `service-kit` (services API uniquement) : `./prisma` (`createPrismaClient`), `./http` (`createCors`, `createRouteResponses`, `readSession`), `./internal-secret` (`hasInternalSecret`, comparaison en temps constant), `./scope`.
- `host-kit` (apps hôtes dispensary / shelter) : `./action` (`createActionErrorParser`, `handleAction`, `getDataOrThrow`, `toUiResult`), `./errors`, `./service-error` (`serviceActionError`), `./service-host` (`createServiceHost`), `./query` (`QueryProvider`), `./realtime`, `./middleware` (`chain`), `./theme` (moteur de thèmes : `themesToCss`, `themeInitScript`, `ThemeProvider` / `useAppTheme`, transition View Transitions). Les fichiers `@/lib/action`, `@/lib/response`… des apps les ré-exportent.
- `*-ui` (`agenda-ui`, `bank-ui`, `inventory-ui`, `media-ui`, `mail-template-ui`) : UI Mantine réutilisable. **Elle ne parle jamais directement au service** : l'app hôte injecte ses server actions via un provider (`BankUiProvider`, `AgendaUiProvider`…). Exemple : `apps/dispensary/src/lib/bank/bankUiActions.ts`.
- Actions bank : la logique est partagée dans `@lawless-intranet/bank-client/host` (`createBankHostActions`). Chaque hôte ne fournit que `withBank` (`lib/bank/client.ts`) et ré-exporte les actions depuis `_actions/bankAccounts.ts`.
- `auth-permissions` : rôles globaux Better Auth et catalogue de permissions.
- `realtime` : temps réel. `./socket` (client WebSocket navigateur), `./token` (jetons signés), `./publish` (publication côté services) et `topics.ts` (noms des topics).
- `mail-template-engine` : parseur et moteur de rendu des templates (variables, conditions).

SSO en local : il faut les hôtes `*.localhost` (cookies cross-subdomain). Voir `docs/SSO-DEV.md`. Docker et déploiement : `docs/DOCKER.md` (le serveur `realtime` a son propre `docker/realtime.Dockerfile`).

## Temps réel

Tout le temps réel passe par le serveur WebSocket `apps/realtime` : agenda et todos, commandes, ventes, activité hebdo, médiathèque et stock (dispensary : quantités, mouvements, crafts, objets, recettes, coffres) ; liste d'attente et médiathèque (refuge). Le détail (lectures GET, mutations, temps réel) est dans `docs/DATA-FLOW.md`.
- Le navigateur se connecte à `REALTIME_PUBLIC_URL` et s'authentifie avec un jeton court signé par l'app hôte (`createRealtimeToken` dans `apps/<dispensary|shelter>/src/lib/realtime/token.ts`, servi en GET par `/api/<d|s>/<slug>/realtime-token` et lu par `fetchRealtimeToken`). **Le jeton liste les topics autorisés : c'est là que se vérifient les droits.**
- Le code qui écrit (service ou app hôte) publie après le commit avec `publishRealtime(topics, envelope)` (`@lawless-intranet/realtime/publish`), qui ne lève jamais d'exception. Les fonctions `emit*` l'appellent dans `after()` (`next/server`) : la requête n'attend pas le serveur temps réel, donc on ne les `await` pas. Exemples : `apps/agenda/src/lib/realtime/broadcast.ts`, `apps/dispensary/src/lib/orders/realtime/broadcast.ts`. En prod, tout publieur rejoint le réseau Docker `realtime` avec `REALTIME_INTERNAL_URL` / `REALTIME_INTERNAL_SECRET`.
- Une mutation transmet le `clientId` du socket (`realtimeMutationMeta(clientId)` côté client, `parseRealtimeMutationMeta(meta)` côté action) : l'auteur ne reçoit pas son propre écho, puisque son `onSuccess` invalide déjà.
- Les messages ne sont que des indices (« tel agenda a changé ») : côté client, on **invalide des requêtes React Query** (sans `refetchType: 'all'`), jamais de patch d'état à partir du message. Pour une simple invalidation, `coalesceMs` de `useRealtimeSocketEvents` regroupe les rafales. Après une reconnexion, `useRealtimeSocketResync` recharge tout (différé si l'onglet est caché). La boucle de connexion (`packages/realtime/src/connection.ts`) réutilise le jeton tant qu'il est valide et ne réessaie pas sans jeton.
- « Voit tout » / « voit les siennes » : un topic par tenant plus un topic par utilisateur dans le tenant (ex. `sales:<id>` et `sales:<id>:user:<userId>`), le jeton n'en reçoit qu'un selon la permission.
- Pour un nouveau domaine : définir ses topics (`packages/realtime/src/topics.ts`), les ajouter au jeton, publier depuis le code qui écrit, puis consommer avec `useRealtimeSocketEvents`.

## Commandes

```bash
pnpm install
pnpm dev                                  # toutes les apps (turbo), serveur realtime compris (aucune config en dev)
pnpm --filter dispensary dev              # une seule app
pnpm --filter <app> typecheck             # tsc --noEmit
pnpm --filter <app> lint
pnpm --filter <app> test                  # vitest (dispensary, shelter, documents, media, inventory, agenda-ui, media-ui, inventory-ui, realtime, mail-template-engine) ; inventory : tests d'intégration du craft sur la base locale (ignorés si DATABASE_URL n'est pas sur localhost)
pnpm --filter <app> exec vitest run src/lib/rpCalendar.test.ts   # un seul fichier
pnpm --filter <app> db:migrate            # prisma migrate dev (crée la migration)
pnpm --filter <app> db:generate
pnpm db:migrate:deploy                    # applique les migrations en attente de toutes les apps (après un pull, un merge…)
pnpm db:migrate:status                    # état des migrations de toutes les apps
pnpm db:generate                          # régénère les clients Prisma de toutes les apps
pnpm db:pull-prod                         # copie les bases de prod en local (.env.prod, voir docs/DB-PULL-PROD.md)
```

Après une modification de `prisma/schema.prisma`, créer une migration avec `db:migrate` dans l'app concernée. En prod, le conteneur exécute `prisma migrate deploy` au démarrage. En local, après un pull ou un merge qui apporte des migrations, lancer `pnpm db:migrate:deploy`.

**Scripts de migration globaux** (`package.json` racine) : ils tournent sur toutes les apps de `apps/**` qui définissent `db:migrate:deploy`, `db:migrate:status` et `db:generate`. **À maintenir dès que nécessaire** : toute nouvelle app avec Prisma doit définir ces trois scripts (sur le modèle des apps existantes) ; si une app Prisma vit hors de `apps/` ou si ces scripts changent de nom, mettre à jour les scripts racine dans le même commit.

## Façon de développer (apps front : dispensary / shelter)

### Couches

- `src/app/(loggedIn)/…/page.tsx` : **Server Component**. Charge les données initiales via les server actions, les déballe avec `getDataOrThrow`, puis passe `initial*` à un `*PageClient`.
- `src/app/_actions/*.ts` : **server actions** (`'use server'`). C'est la seule source de vérité serveur ; il n'y a pas d'API REST interne pour le front.
- `src/lib/<feature>/` : logique métier pure, auth de la feature (`auth.ts`), `queryKeys.ts`, tests unitaires `*.test.ts` à côté du code.
- `src/types/` : types de l'app, dont `routes.ts` (`tenantRoutes(slug)`). **Toujours construire les URLs avec ce helper.**
- `src/middleware.ts` + `src/middlewares/*` : chaîne de gardes (connexion, accès tenant, permissions, feature activée).

### Server actions : forme standard

```ts
'use server';
export async function doThing(slug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(slug, {
      feature: 'xxx',
      permission: { resource: 'xxx', action: 'update' },
    });
    if (!ctx.ok) return ctx.response;
    const data = schema.parse(input);           // zod (import depuis 'zod/v3')
    // … prisma, avec un filtre sur le tenant (dispensaryId / shelterId)
    return { status: 200, data };
  } catch (error) {
    return actionErrorParser(error);
  }
}
```

- Une action **retourne toujours** `{ status, data?, error? }` et ne lève pas d'exception vers le client. `actionErrorParser` convertit les erreurs Zod en 422 avec une erreur par champ.
- Côté client, on déballe avec `handleAction(result)`, qui lève une exception si le statut est ≥ 400.
- **Toujours** passer par le garde `requireTenantServerActionContext`, qui vérifie le tenant, la session, la feature et la permission, et **toujours** filtrer les requêtes Prisma par tenant.
- Sérialiser les `Prisma.Decimal` en `number` avant de les renvoyer au client.

### Logs applicatifs (`docs/APP-LOGS.md`)

- Journal plateforme (`/platform/logs`, table `app_logs`) : **chaque mutation de toutes les features**, quel que soit le résultat ; les erreurs serveur (lectures comprises, automatique via `actionErrorParser` / `serviceActionError`) ; chaque requête du bot Discord. Les lectures ne sont pas loguées sinon.
- **Toute nouvelle mutation exportée** d'un fichier `_actions` : corps dans `<nom>Unlogged`, export enveloppé par `loggedAction` (schéma dans `docs/APP-LOGS.md`, vérifié par `lib/logs/coverage.test.ts`). Nouvelle route du bot : `withBotRouteLog`, et relancer (`throw`) les erreurs inattendues au lieu de renvoyer leur message brut. Nouvelle page de feature : l'ajouter à `lib/logs/paths.ts`.
- Ne jamais mettre de secret ni de gros contenu dans le `context` d'un log.

### Permissions et features

- Il y a deux niveaux. Les **rôles globaux** Better Auth sont dans `packages/auth-permissions`. Les **permissions par tenant** (rôles et membres) sont dans `lib/business/permissions*` et `lib/shelter/permissionsCatalog`, et se vérifient avec `can(perms, resource, action)`.
- **Feature toggles** par tenant (`AppSettings`, `AppFeatureKey` dans `lib/appSettingsShared.ts`). Une nouvelle feature doit être ajoutée au toggle, au middleware et au garde des actions.
- **Types d'entreprise** (dispensary, `docs/MULTI-BUSINESS.md`) : `Business.type` (`BusinessType`) et le registre `lib/businessTypes` (modules proposés, rôles des membres, matrice de rôles par défaut). Un module n'est actif que s'il est **proposé par le type** et activé dans les réglages : `normalizeAppSettings` coupe les autres, donc les lectures `feature*Enabled` et `isAppFeatureEnabled` en tiennent compte. Une nouvelle feature s'ajoute à `lib/appFeatures.ts`, puis aux `modules` des types concernés.
- Côté client, `PermissionsContext` / `usePermissions()` sert à masquer ou afficher l'UI.

### Data fetching client

Pour **tout nouveau code** et toute refonte : **React Query**, avec des lectures en GET (`fetchRead`) et des mutations en server actions. Lire `apps/dispensary/docs/react-query.md` et `docs/DATA-FLOW.md` ; le module de référence est stock (`lib/stock/queryKeys.ts`, `…/stock/hooks/useStockQueries.ts`).
- Server actions pour les **mutations** et le chargement SSR des `page.tsx`. Next les exécute **une par une par onglet** (dans la file de la navigation) : ne pas s'en servir pour les relectures client.
- Relectures côté client (`queryFn`, chargements au clic, recherches au fil de la frappe, actions de lecture injectées dans les `*-ui`) : `fetchRead(slug, '<query>', input)` (`lib/read/fetchRead.ts`), une GET same-origin vers `/api/d/<slug>/read/<query>` (refuge : `/api/s/<slug>/read/<query>`) qui réutilise l'action de lecture inscrite dans le registre fermé `lib/read/readRoutes.ts` (auth et permissions restent dans l'action, `Date` conservées ; helpers partagés dans `@lawless-intranet/host-kit/read`). Même forme de résultat : `queryFn: async () => handleAction(await fetchRead(...))`. Toute nouvelle lecture client passe par le registre. Exceptions : une lecture qui écrit (`getOrCreateWeek`) ou dont l'entrée ne tient pas dans une URL (`generateOrderMailPreview`) reste une action. Le middleware ne couvre pas `/api` : le garde de l'action est la seule protection.
- `initialData` vient du SSR, et les query keys incluent le slug.
- `useMutation` + invalidation ciblée. Les notifications sont gérées dans le hook de mutation, pas dans la page.
- À ne pas reproduire : le pattern legacy `useState` + `useEffect` + `loadX()`. `runAsyncEffect` reste admis seulement pour le temps réel ou les effets sans cache.

### UI / design system

- Mantine 8, `mantine-datatable`, `@tabler/icons-react`, modules SCSS, `@dnd-kit` pour les listes triables.
- Dispensary, thème **« Apothecary »** (crème, encre, `sage` / `leather`) : les règles complètes sont dans `apps/dispensary/.cursor/rules/apothecary-design-system.mdc`. **À lire avant tout changement UI.**
- Dispensary, **thèmes** : `lib/themes` (« Apothicaire » clair par défaut, « Lampe à huile » sombre), un par utilisateur (`UserUiPreferences.theme` + cookie `disp-theme`). On change de thème avec le bouton du header ou `/settings` › Apparence. Chaque thème génère les variables `--disp-*` et les teintes `--disp-<palette>-soft`, `-soft-strong`, `-soft-border`, `-soft-text`, scopées par `html[data-disp-theme]`. `dispTokens.colors` ne contient que des `var(...)`. **Pour un fond teinté, utiliser `--disp-<palette>-soft*`, pas `--mantine-color-<palette>-0/1`**, qui restent clairs en sombre. Le texte d'accent passe par `light-dark(...)`.
- Shelter, thème **« refuge 1890 »** (parchemin, primaire `terracotta`) : voir `apps/shelter/src/lib/design-tokens.ts` et `theme.ts`.
- Shelter, **thèmes** : même moteur, dans `lib/themes` (« Refuge 1890 » par défaut, « Veillée » sombre), avec `UserUiPreferences.theme` et le cookie `shelter-theme`. Le thème clair garde deux jeux de valeurs historiques, les variables SCSS (`--shelter-bg`, `--shelter-surface`…) et les styles Mantine (`--shelter-ui-*`, via `shelterTokens`), pour un rendu identique ; le sombre les fait pointer vers les mêmes valeurs. Teintes : `--shelter-<palette>-soft*`.
- Pastilles partagées (`apothecaryPillStyle`, `shelterPillStyle`) : `light-dark()` à partir de leur propre palette, donc rien à configurer côté hôte.
- Règles communes :
  - pas de hex en dur : utiliser les tokens et les variables CSS `--disp-*` / `--shelter-*` (sinon le thème sombre casse) ;
  - pas de couleurs Mantine par défaut (`red`, `blue`, `gray`…) ;
  - réutiliser `PageHeader`, `AppModal` (dispensary), `ModuleCard`, `DeleteConfirmPopover`, `MarkdownContent`, etc.
- Les liens de navigation doivent être de vrais liens (`<Link>` / `component={Link}`), pour que le clic milieu fonctionne.
- Pour la dette legacy (couleurs, fetch manuel), migrer **uniquement les fichiers qu'on touche** et ne pas lancer de refactor massif non demandé.

### Qualité (ESLint aligné, voir `apps/dispensary/.cursor/rules/react-quality.mdc`)

- Pas de `setState` synchrone dans un `useEffect` ; dériver l'état pendant le rendu.
- `import { type Foo }` pour les imports de types ; `===` ; pas de `console.log`.
- Pas de `any` : utiliser `unknown` puis affiner le type. Préfixer les variables inutilisées par `_`.
- Valider avant de livrer : `typecheck`, `lint` et `test` sur les apps touchées. Si un package partagé change, valider aussi les apps qui le consomment.

## Ajouter un service ou découper une feature

Les modules historiques (auth, documents, agenda, bank, inventory) ont été extraits du dispensary vers des services. Le schéma à suivre est le suivant :
1. une nouvelle app API, avec sa propre base, scopée par `scopeType` / `scopeId` ;
2. les types dans `packages/types` ;
3. un package client `packages/<x>-client`, dont le `config.ts` instancie `createServiceFetch` (`service-client`) ; côté service, `lib/{prisma,cors,auth,internalAuth}.ts` s'appuient sur `service-kit` ;
4. si besoin, un package UI `packages/<x>-ui` avec des actions injectées. Côté hôte : `lib/<x>/client.ts` (scope et cookie via `serviceHost`), erreurs avec `serviceActionError` ou `withTenantService` (`@/lib/serviceAction`), mapping UI avec `toUiResult` ;
5. un script de migration de données dans `scripts/` (préserver les IDs), à exposer dans le `package.json` racine ;
6. les scripts `db:migrate`, `db:migrate:deploy`, `db:migrate:status` et `db:generate` dans le `package.json` de l'app (repris par les scripts globaux, voir « Commandes ») ;
7. un secret interne partagé, plus les variables d'env dans `turbo.json`, `docker-compose.yml` et `docs/SSO-DEV.md`.

## Git

- Branches : on développe sur `dev`, `main` sert à la prod. Branches de feature nommées `feat(<scope>)/<nom>`.
- Commits **Conventional Commits en anglais**, avec un scope d'app : `feat(shelter): …`, `fix(agenda): …`, `perf(docker): …`, `refactor(dispensary): …`.
