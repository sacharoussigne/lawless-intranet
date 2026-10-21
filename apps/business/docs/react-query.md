# Data fetching client — React Query + Server Actions

Ce guide décrit le standard du projet pour charger et muter des données serveur côté client.

## Stack

- **Next.js App Router** — pages Server Components pour le chargement initial
- **Server actions** (`'use server'`) — source de vérité serveur : mutations et chargement SSR des `page.tsx`
- **Lectures GET** (`fetchRead`) — relectures côté client, via une route GET générique qui réutilise les actions de lecture (pas d'API REST par feature, voir ci-dessous)
- **@tanstack/react-query v5** — cache, déduplication, invalidation côté client

## Setup

Le `QueryProvider` est monté dans le layout dispensary :

- [`src/lib/react-query/QueryProvider.tsx`](../src/lib/react-query/QueryProvider.tsx)
- [`src/app/(loggedIn)/[businessSlug]/layout.tsx`](../src/app/(loggedIn)/[businessSlug]/layout.tsx)

Valeurs par défaut : `staleTime: 5s`, `refetchOnWindowFocus: false`.

Le `QueryClient` du navigateur survit aux navigations client, et `initialData` (SSR) est **ignoré** dès que la clé est déjà en cache. Le `staleTime` court garantit qu’en revenant sur une page (retour ou lien) les données sont rechargées en arrière-plan au lieu d’afficher l’ancien état. Ne pas le rallonger sans cette contrainte en tête.

## Pourquoi des lectures en GET

Next exécute les server actions **une par une par onglet**, dans la file de la navigation. Une relecture React Query, une recherche au fil de la frappe ou le jeton temps réel attendent donc la mutation en cours, et inversement. Les relectures client passent par :

- `src/lib/read/readRoutes.ts` : registre fermé `clé → action de lecture` (seules les clés listées existent) ;
- `src/app/api/d/[businessSlug]/read/[query]/route.ts` : la route GET (`createReadRouteHandler` de `@lawless-intranet/host-kit/read`) ;
- `src/lib/read/fetchRead.ts` : le client typé, `fetchRead(slug, '<clé>', input)`.

L'action est réutilisée telle quelle : auth, tenant, feature et permission restent dans l'action (le middleware ne couvre pas `/api`). L'entrée passe en query string (`?input=`), les `Date` sont conservées. Même forme de résultat qu'une action : `{ status, data?, error? }`.

Pour une nouvelle lecture : l'inscrire au registre, puis l'appeler avec `fetchRead`. Une lecture qui écrit (`getOrCreateWeek`) ou dont l'entrée est trop grosse pour une URL reste une action.

## Pattern lecture (SSR + client)

### Server Component

```tsx
const [itemsResult, checksResult] = await Promise.all([
  getItemsWithStock(businessSlug),
  getStockChecksSummary(businessSlug),
]);
const items = getDataOrThrow(itemsResult, '...');
const checks = getDataOrThrow(checksResult, '...');

return <StockPageClient initialItems={items} initialStockChecksSummary={checks} />;
```

### Client — hook query

Référence : [`src/app/(loggedIn)/[businessSlug]/stock/hooks/useStockQueries.ts`](../src/app/(loggedIn)/[businessSlug]/stock/hooks/useStockQueries.ts)

```tsx
export function useStockItems(chestId: string | null, initialData: ItemWithRelations[]) {
  const { businessSlug } = usePermissions();

  return useQuery({
    queryKey: stockKeys.items(businessSlug!, chestId),
    queryFn: () => fetchStockItems(businessSlug!, chestId),
    initialData: chestId === null ? initialData : undefined,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}
```

Points clés :

- Passer `initialData` depuis le SSR quand la clé correspond au premier rendu (`chestId === null`)
- Ne **pas** ajouter un `useEffect` + `loadItems()` en parallèle du SSR
- Inclure `businessSlug` dans les query keys (multi-tenant)

## Pattern mutation

```tsx
export function useUpdateStockMutation() {
  const invalidateStock = useInvalidateStockItems();

  return useMutation({
    mutationFn: async (vars) => {
      const result = await updateStock(businessSlug!, vars.stockData, vars.targetChestId, ...);
      handleAction(result);
      return vars;
    },
    onSuccess: (vars) => {
      invalidateStock([null, vars.targetChestId]);
      notifications.show({ title: 'Succès', color: 'moss', ... });
    },
    onError: (error) => {
      notifications.show({ title: 'Erreur', color: 'danger', ... });
    },
  });
}
```

- Notifications dans le hook mutation, pas dans la page
- Invalidation **ciblée** des coffres touchés
- Pas de `await loadItems()` manuel après mutation

## Organisation des fichiers

| Emplacement | Rôle |
|---|---|
| `src/lib/react-query/QueryProvider.tsx` | Provider global |
| `src/lib/<feature>/queryKeys.ts` | Clés hiérarchiques partagées |
| `src/app/.../<feature>/hooks/useXxx.ts` | Hooks query/mutation par feature |

Convention des clés :

```ts
export const stockKeys = {
  all: (slug: string) => ['stock', slug] as const,
  items: (slug: string, chestId: string | null) =>
    [...stockKeys.all(slug), 'items', chestId] as const,
};
```

## Anti-patterns interdits

### Double fetch SSR + useEffect

```tsx
// ❌
useEffect(() => { loadItems(); }, [chestId]);

// ✅
const { data: items } = useStockItems(chestId, initialItems);
```

### Cache manuel ad hoc

```tsx
// ❌ cacheRef dans une modale
// ✅ useStockItems / useQueries avec les mêmes query keys
```

### Envoyer tous les items en mutation alors que seuls quelques-uns changent

```tsx
// ❌ items.map(...) → updateStock(all)
// ✅ getChangedStockEntries(items, editedQuantities)
```

## Migration legacy

Le pattern `useState` + `useEffect` + `loadX()` (ex. agenda) est **legacy**. Lors d'une refonte de feature, migrer vers React Query. Ne pas migrer massivement hors scope.

`runAsyncEffect` reste valide pour les subscriptions temps réel ou effets ponctuels sans cache (ex. `AgendaRealtimeProvider` dans `@lawless-intranet/agenda-ui`).

## Implémentation de référence

Module **stock** :

- [`useStockQueries.ts`](../src/app/(loggedIn)/[businessSlug]/stock/hooks/useStockQueries.ts)
- [`StockPageClient.tsx`](../src/app/(loggedIn)/[businessSlug]/stock/StockPageClient.tsx)
- [`queryKeys.ts`](../src/lib/stock/queryKeys.ts)
