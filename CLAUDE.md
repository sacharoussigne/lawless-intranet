# CLAUDE.md

Guide pour travailler sur **lawless-intranet**.

## Concept

Intranet pour un serveur **RP western (RedM, ~1890)**. Il sert à des organisations en jeu : le **dispensaire de Saint-Denis** (stock, commandes, ventes, banque, courriers, paie, activité hebdo, agenda, cabinet) et le **refuge animalier** (animaux, espèces/races, suivis, liste d'attente, documents, banque).

- **Multi-tenant** : chaque organisation a un slug. Routes `/d/[dispensarySlug]/…` (dispensary) et `/s/[shelterSlug]/…` (shelter). Les espaces sont `employee/`, `management/`, `admin/` ; `platform/` sert à l'admin global.
- **Calendrier RP** : les dates sont stockées en réel et affichées **136 ans plus tôt** (`RP_DISPLAY_YEAR_OFFSET` dans `lib/rpCalendar.ts`). Ne jamais écrire de date RP en base. Côté UI, utiliser `formatRpDate`, `RpDateInput`, etc.
- **Langue** : l'UI, les messages d'erreur et les docs sont en **français**. Le code (identifiants) et les messages de commit sont en **anglais**.

## Architecture (monorepo pnpm + Turborepo)

Toutes les apps sont en Next.js 16 (App Router), React 19, Prisma 7 (`@prisma/adapter-pg`, client généré dans `src/generated/prisma`) et PostgreSQL. **Chaque app a sa propre base.**

| App | Port | Rôle |
|---|---|---|
| `apps/dispensary` | 3000 | Front du dispensaire (Mantine) |
| `apps/auth` | 3001 | Fournisseur d'identité SSO (Better Auth, Discord OAuth) |
| `apps/documents` | 3002 | API des documents et templates |
| `apps/agenda` | 3003 | API agenda et todos (+ SSE temps réel) |
| `apps/bank` | 3004 | API banque (semaines, transactions, transactions planifiées) |
| `apps/inventory` | 3005 | API inventaire |
| `apps/shelter` | 3006 | Front du refuge (Mantine) |

Les **services** (documents, agenda, bank, inventory) n'exposent que des route handlers `src/app/api/**/route.ts`. Leurs données sont cloisonnées par `scopeType` / `scopeId` (par exemple le dispensaire X ou le refuge Y). Ils authentifient l'appelant de deux façons :
- le cookie de session SSO, transmis tel quel (`getSession(cookieHeader)` de `@lawless-intranet/auth-client/server`) ;
- un header de secret interne (`x-<service>-internal-secret`) pour les opérations hôte.

Packages partagés (`packages/*`, consommés en TS source via `workspace:*`, sans build) :
- `types` : DTO partagés entre les services et leurs clients.
- `*-client` (`agenda`, `bank`, `documents`, `inventory`, `auth`) : clients fetch typés vers les services. L'export `./server` est réservé au côté serveur.
- `*-ui` (`agenda-ui`, `bank-ui`, `inventory-ui`, `mail-template-ui`) : UI Mantine réutilisable. **Elle ne parle jamais directement au service** : l'app hôte injecte ses server actions via un provider (`BankUiProvider`, `AgendaUiProvider`…). Exemple : `apps/dispensary/src/lib/bank/bankUiActions.ts`.
- `auth-permissions` : rôles globaux Better Auth et catalogue de permissions.
- `realtime` : hub SSE avec bus `pg LISTEN/NOTIFY` (`./server`, `./client`).
- `mail-template-engine` : parseur et moteur de rendu des templates (variables, conditions).

SSO en local : il faut les hôtes `*.localhost` (cookies cross-subdomain). Voir `docs/SSO-DEV.md`. Docker et déploiement : `docs/DOCKER.md`.

## Commandes

```bash
pnpm install
pnpm dev                                  # toutes les apps (turbo)
pnpm --filter dispensary dev              # une seule app
pnpm --filter <app> typecheck             # tsc --noEmit
pnpm --filter <app> lint
pnpm --filter <app> test                  # vitest (dispensary, shelter, documents, agenda-ui, realtime, mail-template-engine)
pnpm --filter <app> exec vitest run src/lib/rpCalendar.test.ts   # un seul fichier
pnpm --filter <app> db:migrate            # prisma migrate dev (crée la migration)
pnpm --filter <app> db:generate
```

Après une modification de `prisma/schema.prisma`, créer une migration avec `db:migrate` dans l'app concernée. En prod, le conteneur exécute `prisma migrate deploy` au démarrage.

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

### Permissions et features

- Il y a deux niveaux. Les **rôles globaux** Better Auth sont dans `packages/auth-permissions`. Les **permissions par tenant** (rôles et membres) sont dans `lib/dispensary/permissions*` et `lib/shelter/permissionsCatalog`, et se vérifient avec `can(perms, resource, action)`.
- **Feature toggles** par tenant (`AppSettings`, `AppFeatureKey` dans `lib/appSettingsShared.ts`). Une nouvelle feature doit être ajoutée au toggle, au middleware et au garde des actions.
- Côté client, `PermissionsContext` / `usePermissions()` sert à masquer ou afficher l'UI.

### Data fetching client

Pour **tout nouveau code** et toute refonte : **React Query + server actions**. Lire `apps/dispensary/docs/react-query.md` ; le module de référence est stock (`lib/stock/queryKeys.ts`, `…/stock/hooks/useStockQueries.ts`).
- `queryFn: () => handleAction(await action(...))`, avec `initialData` venant du SSR et des query keys qui incluent le slug.
- `useMutation` + invalidation ciblée. Les notifications sont gérées dans le hook de mutation, pas dans la page.
- À ne pas reproduire : le pattern legacy `useState` + `useEffect` + `loadX()`. `runAsyncEffect` reste admis seulement pour le temps réel ou les effets sans cache.

### UI / design system

- Mantine 8, `mantine-datatable`, `@tabler/icons-react`, modules SCSS, `@dnd-kit` pour les listes triables.
- Dispensary, thème **« Apothecary »** (crème, encre, `sage` / `leather`) : les règles complètes sont dans `apps/dispensary/.cursor/rules/apothecary-design-system.mdc`. **À lire avant tout changement UI.**
- Shelter, thème **« refuge 1890 »** (parchemin, primaire `terracotta`) : voir `apps/shelter/src/lib/design-tokens.ts` et `theme.ts`.
- Règles communes :
  - pas de hex en dur : utiliser les tokens et les variables CSS `--disp-*` / `--shelter-*` ;
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
3. un package client `packages/<x>-client` ;
4. si besoin, un package UI `packages/<x>-ui` avec des actions injectées ;
5. un script de migration de données dans `scripts/` (préserver les IDs), à exposer dans le `package.json` racine ;
6. un secret interne partagé, plus les variables d'env dans `turbo.json`, `docker-compose.yml` et `docs/SSO-DEV.md`.

## Git

- Branches : on développe sur `dev`, `main` sert à la prod. Branches de feature nommées `feat(<scope>)/<nom>`.
- Commits **Conventional Commits en anglais**, avec un scope d'app : `feat(shelter): …`, `fix(agenda): …`, `perf(docker): …`, `refactor(dispensary): …`.
