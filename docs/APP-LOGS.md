# Logs applicatifs (dispensaire)

Journal **à l'échelle de l'application** (pas d'un dispensaire), lu par les admins plateforme sur `/platform/logs` (menu Plateforme › Logs). Il sert à comprendre ce qui s'est passé quand quelqu'un dit « j'ai cliqué et rien ne s'est passé ».

## Ce qui est logué

| Quoi | Type (`kind`) | Niveau | Où c'est branché |
|---|---|---|---|
| **Chaque modification** (création, modification, suppression, action métier) de **toutes** les features, quel que soit le résultat | `ACTION` | `INFO` réussi ou rien à faire, `WARN` refusé ou invalide, `ERROR` échec | `loggedAction` sur chaque mutation exportée de `src/app/_actions/**` ; `withLoggedAction` (libellés français, cas « déjà fait ») pour l'activité hebdo et la paie |
| Erreur serveur (500, exception inattendue), **lectures comprises** | `ERROR` | `ERROR` | automatique : `actionErrorParser` / `serviceActionError` (`src/lib/action.ts`, `src/lib/serviceAction.ts`) |
| **Chaque requête** du bot Discord | `BOT_REQUEST` | `INFO` 2xx, `WARN` 4xx, `ERROR` 5xx | `withBotRouteLog` sur les routes `src/app/api/dispensary/weekly-activity/**` et `api/dispensary/bank/bot/**` |

Les **lectures** (`get…`, `list…`, `search…`), rappelées en permanence par React Query et le temps réel, ne sont loguées qu'en cas d'erreur serveur. Une page qui recharge ses données ne crée donc aucune ligne.

Chaque ligne (`AppLog`, table `app_logs`) porte : date, niveau, type, feature, événement (`weeklyActivity.chest.mark`, `bot.caisse`…), résultat (`success`, `noop`, `denied`, `invalid`, `failure`), message, source (intranet, bot, système), dispensaire, utilisateur, Discord id, statut HTTP, durée, chemin, **objet visé** (`targetId`), `context` (entrée nettoyée, résumé du résultat) et `error` (nom, message, code, stack, cause).

Une modification en échec donne **deux lignes** : l'action (`ACTION`, `failure`) et l'erreur serveur (`ERROR`, avec la stack). Les deux portent le même objet visé quand il est connu.

## Objet visé (`targetId`)

Chaque ligne d'action porte, quand on peut le connaître, l'**id de l'objet touché** (entreprise créée, vente annulée, coffre modifié…). Le champ « Objet (id) » de la page, ou « Voir son historique » dans le détail d'une ligne, affiche tout l'historique de cet objet : création, modifications, suppression, refus et échecs.

Règles par défaut (`defaultTargetId`, `src/lib/logs/target.ts`), appliquées à l'argument qui suit le slug :
1. l'`id` de l'objet d'entrée (`data: { id }`) : modifications, suppressions ;
2. l'argument lui-même s'il s'agit d'une chaîne (`id: string`, `saleId: string`) ;
3. l'`id` des données du résultat : créations réussies.

Il n'y a donc pas d'id pour une création en échec (l'objet n'existe pas, son entrée reste dans `context`) ni pour une action groupée (réordonnancement, déplacement de plusieurs fichiers : les ids sont dans `context`). En cas d'exception, seul l'id de l'entrée est connu.

Quand ces règles se trompent (pas d'`id`, ou un objet parent plus parlant), passer `target` :

```ts
loggedAction(
  { feature: 'agenda', event: 'members.upsertAgendaMember', target: ([, data]) => data.agendaId },
  args,
  () => upsertAgendaMemberUnlogged(...args),
);
```
`target(args, result)` reçoit tous les arguments (slug compris) et le résultat (`undefined` si l'action a levé une exception). Avec `withLoggedAction`, le défaut est l'`id` de `context` puis celui du résultat ; `describe` peut renvoyer `targetId`.

## Lire un cas « le bot n'a rien fait »

Filtrer par Discord id (champ « Utilisateur ou Discord id ») et par période, type « Requête bot » :
- **une ligne `success`** : l'action a été faite ; le problème est l'affichage côté bot ;
- **`noop`** (« rien à faire ») : c'était déjà fait (ex. caisse déjà cochée), le message renvoyé au bot est dans la ligne ;
- **`denied` / `invalid`** : refus (secret, feature désactivée, champ masqué) ou demande invalide (jour futur, hors de la semaine…), la raison est dans le message ;
- **`failure`** : erreur serveur, la stack et sa cause sont dans le détail (ex. `fetch failed` → cause `ECONNREFUSED` : un service n'a pas répondu) ;
- **aucune ligne** : la requête n'est jamais arrivée au serveur → problème côté bot ou réseau.

Les dates de la page sont en **heure réelle** (pas le calendrier RP), pour les comparer aux horodatages de Discord.

## Ajouter des logs

Le logger (`src/lib/logs/`) ne lève jamais d'exception et ne ralentit pas la réponse (écriture en arrière-plan, gardée en vie par `after()`).

- **Toute nouvelle mutation exportée** (obligatoire, vérifié par `src/lib/logs/coverage.test.ts`) : le corps va dans `<nom>Unlogged`, l'export l'enveloppe.

  ```ts
  async function createThingUnlogged(dispensarySlug: string, input: Input) {
    /* action standard */
  }

  export async function createThing(...args: Parameters<typeof createThingUnlogged>) {
    return loggedAction({ feature: 'orders', event: 'things.createThing' }, args, () =>
      createThingUnlogged(...args),
    );
  }
  ```
  Le 1er argument (slug) donne le dispensaire, les suivants vont dans `context` (nettoyés) ; l'utilisateur vient de la session. Si les arguments contiennent un secret (mot de passe) ou un gros contenu, passer `context: null` ou un résumé (`context: { id }`). Une lecture (`get…`, `list…`, `search…`) n'est pas enveloppée.
- **Libellé français ou résultat précis** : `withLoggedAction(meta, run, describe)` (voir l'activité hebdo et la paie), par exemple pour classer « déjà fait » en `noop`.
- **Nouvelle route du bot** : `export const POST = withBotRouteLog({ feature: '…', event: 'bot.…' }, handlePost);`. Les erreurs inattendues doivent être **relancées** (`throw`), pas transformées en 500 : le wrapper logue la stack et répond un 500 générique (le message brut n'est jamais envoyé au bot).
- **Ponctuel** : `logAction({ feature, event, outcome, message, context })` ou `logServerError({ error, status, message })` (`src/lib/logs/writer.ts`).
- **Feature d'une erreur automatique** : déduite de la page d'où vient l'action (`src/lib/logs/paths.ts`). Une nouvelle page de feature doit y être ajoutée, sinon ses erreurs sont classées « Inconnue ».

## À ne jamais logger

Le `context` passe par `sanitizeLogContext` (`src/lib/logs/sanitize.ts`) : les clés contenant `password`, `secret`, `token`, `authorization`, `cookie` ou `apiKey` sont masquées, les chaînes coupées à 2 000 caractères, le tout limité à ~16 Ko. Malgré ça, ne pas mettre dans `context` de secret sous un autre nom, ni de gros contenus (HTML collé, fichiers) : résumer (taille, nombre, ids). Le corps d'une requête du bot refusée par le secret (401) n'est jamais lu.

## Rétention

90 jours (`APP_LOG_RETENTION_DAYS`, `src/lib/logs/retention.ts`). La purge tourne au démarrage du serveur puis toutes les 24 h (`src/instrumentation.ts`, qui enregistre aussi le logger des erreurs automatiques).
