# Flux de données : lectures GET, mutations et temps réel

Comment les apps hôtes (`apps/dispensary`, `apps/shelter`) lisent et écrivent leurs données côté client, et comment le temps réel les tient à jour. Les règles courtes sont dans `CLAUDE.md` ; ce document explique le pourquoi et le comment.

```
                         lectures : GET /api/<d|s>/<slug>/read/<clé>  ──▶ registre ──▶ action de lecture
navigateur (React Query) mutations : server action                     ──▶ action ──▶ Prisma / services
                         jeton temps réel : GET /api/<d|s>/<slug>/realtime-token
     ▲
     │ WebSocket (indices « tel domaine a changé »)
     └──────────── apps/realtime ◀── publishRealtime() dans after() ── code qui écrit
```

## Pourquoi pas de lectures en server action

Next exécute les server actions **une par une par onglet**, dans la même file que la navigation. Une lecture faite en server action attend donc la mutation en cours, la navigation et les autres lectures, et inversement. Les symptômes : une recherche au fil de la frappe qui rame pendant un enregistrement, une page qui met du temps à s'afficher après un événement temps réel, un clic bloqué derrière des relectures.

D'où la répartition :

| Usage | Transport |
|---|---|
| Chargement initial d'une page (`page.tsx`, Server Component) | appel direct de l'action, côté serveur |
| Relecture côté client (`queryFn`, ouverture d'une modale, recherche, action de lecture injectée dans un `*-ui`) | **GET** via `fetchRead` |
| Mutation | server action |
| Jeton temps réel, thème du compte | GET dédié (`/realtime-token`, `/api/me/theme`) |

Les requêtes GET partent en parallèle, hors de la file des actions.

## Lectures GET : le registre

Il n'y a **pas d'API REST par feature**. Chaque app a une seule route GET générique qui réutilise les actions de lecture existantes :

| | Dispensaire | Refuge |
|---|---|---|
| Registre | `apps/dispensary/src/lib/read/readRoutes.ts` | `apps/shelter/src/lib/read/readRoutes.ts` |
| Route | `src/app/api/d/[dispensarySlug]/read/[query]/route.ts` | `src/app/api/s/[shelterSlug]/read/[query]/route.ts` |
| Client | `src/lib/read/fetchRead.ts` | `src/lib/read/fetchRead.ts` |

La mécanique est partagée dans `packages/host-kit/src/read.ts` (`createReadRouteHandler`, `createFetchRead`).

### Fonctionnement

- **Registre fermé** : un objet `clé → (slug, input) => action(slug, …)`. Seules les clés listées existent ; une clé inconnue répond 404.
- **Entrée** : sérialisée en JSON dans `?input=`. Les `Date` sont conservées (encodées `{ "$date": "<iso>" }`), comme avec une server action.
- **Sortie** : exactement le résultat de l'action, `{ status, data?, error? }`, avec le même code HTTP. Côté client on déballe comme d'habitude avec `handleAction`.
- **Cache HTTP** : `Cache-Control: private, no-store`. Le cache, c'est React Query ; le temps réel l'invalide.
- **Même origine uniquement** : pas de CORS, cookie de session envoyé automatiquement.

### Sécurité

- **Le middleware ne couvre pas `/api`.** La seule protection est le garde de l'action (`requireTenantServerActionContext` ou `requireXxxAdminContext`) : tenant, session, feature, permission. Une action inscrite au registre doit donc **toujours** avoir son garde, comme n'importe quelle server action.
- L'entrée vient du client : l'action la valide (zod) comme elle le ferait pour une server action. Ne pas exposer dans le registre d'options sensibles qu'aucun client ne devrait passer (exemple : `getChestsList` est inscrite sans son option `bypassAccessFilter`).
- Une entrée malformée qui fait planter l'action répond 400, sans détail.

### Ajouter une lecture

1. Écrire (ou garder) l'action de lecture dans `src/app/_actions/`, avec son garde.
2. L'inscrire au registre :

   ```ts
   // lib/read/readRoutes.ts
   chestStockCheckForm: (slug: string, input: { chestId: string }) =>
     getChestStockCheckForm(slug, input?.chestId),
   // sans entrée :
   companies: (slug: string, _input?: undefined) => getCompanies(slug),
   ```

3. L'appeler côté client :

   ```ts
   queryFn: async () => handleAction(await fetchRead(slug, 'chestStockCheckForm', { chestId })),
   ```

Détails de typage : une entrée déclarée `_input?: undefined` se passe sans argument (`fetchRead(slug, 'companies')`). Une entrée objet aux champs tous optionnels reste obligatoire : passer `{}` (`fetchRead(slug, 'items', {})`).

Pour les UI partagées (`bank-ui`, `inventory-ui`, `media-ui`…), on ne touche pas au package : l'hôte remplace l'action par `fetchRead` dans son objet d'actions injectées (`lib/<x>/<x>UiActions.ts`), avec `toUiResult` comme avant.

### Ce qui reste en server action

- **Une lecture qui écrit** : `getOrCreateWeek` (banque) crée la semaine si elle n'existe pas. Un GET ne doit pas modifier de données.
- **Une entrée trop grosse pour une URL** : `generateOrderMailPreview` reçoit une commande entière. Au-delà de quelques Ko, la query string devient fragile.
- **Les lectures rares hors tenant** : `listUsers` (admin plateforme).

## Mutations

Toujours des server actions, avec la forme standard décrite dans `CLAUDE.md`, appelées dans un `useMutation`. Le `onSuccess` invalide les requêtes concernées et affiche la notification.

Quand le domaine a du temps réel, la mutation transmet le `clientId` du socket pour que l'auteur ne reçoive pas son propre écho (son `onSuccess` a déjà invalidé) :

```ts
// client
const mutationMeta = realtimeMutationMeta(useOptionalRealtimeSocket()?.clientId);
await createOrder(slug, vars, mutationMeta);

// action
export async function createOrder(slug: string, data: CreateOrderInput, meta?: unknown) {
  // … écriture …
  emitOrdersChange(dispensaryId, { orderId: order.id }, parseRealtimeMutationMeta(meta));
}
```

## Temps réel

Le serveur `apps/realtime` relaie des **indices** (« les commandes de tel dispensaire ont changé »). Le client n'applique jamais le contenu d'un message : il invalide des requêtes React Query, qui relisent via GET.

### Côté client (`packages/realtime`)

- **Une seule WebSocket par onglet**, ouverte par `RealtimeSocketProvider` dans le layout du tenant et partagée par tous les abonnés (`useRealtimeSocketEvents`). S'abonner ou se désabonner ne touche jamais au réseau : c'est un filtre local par domaine et type.
- **La boucle de connexion** vit dans `src/connection.ts`, sans React ni DOM, pour être testée (`connection.test.ts`) :
  - une seule connexion à la fois : un réveil (onglet de nouveau visible, réseau revenu) pendant le chargement du jeton n'ouvre pas une deuxième socket ;
  - le jeton est réutilisé tant qu'il reste valide plus d'une minute ; il est redemandé seulement s'il est expiré, refusé (fermeture `4001` / `4002`) ou après un changement d'accès ;
  - sans jeton (déconnecté, accès retiré) ou origine refusée (`4003`), le client arrête de réessayer jusqu'au prochain réveil ; si l'app hôte ne répond pas (redémarrage), il réessaie ;
  - reconnexion avec backoff exponentiel et jitter : de 0,5 à 1 s au départ, jusqu'à 30 s ;
  - ping toutes les 25 s ; sans message pendant 60 s, la connexion est considérée morte, **seulement si l'onglet est visible** (les onglets cachés ralentissent leurs timers) ;
  - le jeton est renouvelé une minute avant expiration (TTL 30 min), sur la même connexion.
- **Resync** : après une reconnexion, `useRealtimeSocketResync` relance les handlers pour récupérer ce qui a été manqué. Il est différé tant que l'onglet est caché et étalé sur 0 à 2 s, pour que tous les clients ne relisent pas en même temps après un redéploiement du serveur temps réel. La toute première connexion après le rendu SSR ne resynchronise pas : les données viennent d'être chargées.
- **Jeton** : `fetchRealtimeToken('/api/<d|s>/<slug>/realtime-token')`. La route appelle `createRealtimeToken` (`lib/realtime/token.ts`), qui **liste les topics autorisés** : c'est là que se vérifient les droits. Un refus (401, 403, 404, 503) arrête la connexion ; une erreur serveur la fait réessayer.
- **Statut** : `useRealtimeSocketStatus()`, dans un contexte séparé pour qu'une reconnexion ne re-rende pas tous les abonnés.

### Consommer un domaine

```ts
useRealtimeSocketEvents({
  domains: [REALTIME_DOMAIN.orders],
  coalesceMs: 200, // une rafale de N événements = une seule invalidation
  onEvent: () => void queryClient.invalidateQueries({ queryKey: ordersKeys.all(slug) }),
});
useRealtimeSocketResync(() => void queryClient.invalidateQueries({ queryKey: ordersKeys.all(slug) }));
```

Règles :
- **Invalider les requêtes actives seulement** : pas de `refetchType: 'all'`. Les requêtes inactives se rechargeront quand elles seront de nouveau affichées.
- **`coalesceMs`** pour un handler qui ne lit pas le contenu du message (simple invalidation). Il reçoit le dernier message de la rafale.
- **Deux composants qui invalident la même clé pour le même événement** (exemple : header et page) : passer `{ cancelRefetch: false }` pour que le second rejoigne la relecture du premier au lieu de l'annuler.

### Côté écriture

- Le code qui écrit (action d'une app hôte ou route d'un service) appelle une fonction `emit*` / `notify*` **après** l'écriture.
- Ces fonctions publient dans `after()` (`next/server`) : la réponse part sans attendre le serveur temps réel. On ne les `await` pas. `publishRealtime` ne lève jamais d'exception (timeout de 2 s, erreur loguée).
- Exemples : `apps/dispensary/src/lib/orders/realtime/broadcast.ts`, `apps/agenda/src/lib/realtime/broadcast.ts`, `apps/media/src/lib/realtime.ts`.
- **Stock** (`apps/dispensary/src/lib/stock/realtime/`) : un topic `stock:<dispensaryId>` (feature `stock` + `stock:view`) et un seul type de message, sans aucun identifiant de coffre ni d'objet, pour qu'un rôle limité à certains coffres n'apprenne rien sur les autres. Les actions de stock et de catalogue (objets, recettes, coffres, catégories, visibilité, contrôles) sont enveloppées par `withStockChange` ; ventes et commandes appellent `emitStockChange`. Côté client, `StockRealtimeBridge` (layout) invalide toutes les données de stock affichées. Pendant une saisie d'inventaire, la page Stock affiche un bandeau si le stock change entre-temps.

### Ajouter un domaine temps réel

1. Définir ses topics dans `packages/realtime/src/topics.ts` (un topic par tenant, plus un par utilisateur si certains ne voient que leurs propres données).
2. Les ajouter au jeton dans `createRealtimeToken`, derrière la feature et la permission.
3. Écrire une fonction `emit*` qui publie dans `after()`, et l'appeler depuis le code qui écrit, avec `parseRealtimeMutationMeta(meta)`.
4. Côté client : `useRealtimeSocketEvents` + `useRealtimeSocketResync`, qui invalident des clés React Query ; les mutations passent `realtimeMutationMeta(clientId)`.

## Vérifier dans le navigateur

DevTools, onglet **Network** (Vivaldi, Chrome) :
- filtre `/read/` : les relectures partent en `GET` et en parallèle ;
- filtre `Next-Action` (ou en-tête `Next-Action` sur les `POST`) : seules les mutations doivent apparaître ;
- filtre **WS** : une seule connexion temps réel par onglet (l'autre ligne, `webpack-hmr`, est le rechargement à chaud de Next en dev). L'onglet **Messages** de la connexion montre `auth`, `ready`, `ping` / `pong` et `event`.

## Limites connues

- **Médiathèque** : l'auteur d'un changement reçoit encore son propre écho (une relecture de trop par rafale, regroupée par `coalesceMs`). Il faudrait transmettre le `clientId` de `media-ui` jusqu'au service `media`.
- **Stock, pages de gestion** : seules les actions de l'écran Stock (craft, prise/dépôt, transfert, saisie) transmettent le `clientId` ; les pages de gestion (objets, recettes, coffres, catégories) et l'écrasement de stock ne le font pas, et leur auteur reçoit donc une relecture de trop.
- Le serveur temps réel est une instance unique, en mémoire.
