# Logs applicatifs (dispensaire)

Journal **à l'échelle de l'application** (pas d'un dispensaire), lu par les admins plateforme sur `/platform/logs` (menu Plateforme › Logs). Il sert à comprendre ce qui s'est passé quand quelqu'un dit « j'ai cliqué et rien ne s'est passé ».

## Ce qui est logué

| Quoi | Type (`kind`) | Niveau | Où c'est branché |
|---|---|---|---|
| Erreur serveur (500, exception inattendue) de **n'importe quelle** feature | `ERROR` | `ERROR` | automatique : `actionErrorParser` / `serviceActionError` (`src/lib/action.ts`, `src/lib/serviceAction.ts`) |
| **Chaque action** de l'activité hebdo / journalière et de la paie | `ACTION` | `INFO` réussi ou rien à faire, `WARN` refusé ou invalide, `ERROR` échec | `withLoggedAction` dans `src/app/_actions/dispensaryWeeklyActivity.ts` et `payrollReports.ts` |
| **Chaque requête** du bot Discord | `BOT_REQUEST` | `INFO` 2xx, `WARN` 4xx, `ERROR` 5xx | `withBotRouteLog` sur les routes `src/app/api/dispensary/weekly-activity/**` et `api/dispensary/bank/bot/**` |

Les erreurs 4xx des features non sensibles (permission refusée, formulaire invalide) ne sont **pas** loguées : elles sont normales et feraient du bruit.

Chaque ligne (`AppLog`, table `app_logs`) porte : date, niveau, type, feature, événement (`weeklyActivity.chest.mark`, `bot.caisse`…), résultat (`success`, `noop`, `denied`, `invalid`, `failure`), message, source (intranet, bot, système), dispensaire, utilisateur, Discord id, statut HTTP, durée, chemin, `context` (entrée nettoyée, résumé du résultat) et `error` (nom, message, code, stack, cause).

Une action sensible en échec donne **deux lignes** : l'action (`ACTION`, `failure`) et l'erreur serveur (`ERROR`, avec la stack).

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

- **Nouvelle feature sensible** : envelopper chaque mutation exportée.

  ```ts
  async function doThingUnlogged(slug: string, input: Input) { /* action standard */ }

  export async function doThing(slug: string, input: Input) {
    return withLoggedAction(
      { feature: 'payroll', event: 'payroll.thing.do', label: 'Faire la chose', context: input },
      () => doThingUnlogged(slug, input),
      // optionnel : préciser le résultat (ex. "déjà fait" → noop) ou ajouter un résumé
      (result) => (result.status === 200 ? { context: { id: result.data?.id } } : undefined),
    );
  }
  ```
  Le dispensaire et l'utilisateur sont déduits de la requête (page d'origine, session).
- **Nouvelle route du bot** : `export const POST = withBotRouteLog({ feature: '…', event: 'bot.…' }, handlePost);`. Les erreurs inattendues doivent être **relancées** (`throw`), pas transformées en 500 : le wrapper logue la stack et répond un 500 générique (le message brut n'est jamais envoyé au bot).
- **Ponctuel** : `logAction({ feature, event, outcome, message, context })` ou `logServerError({ error, status, message })` (`src/lib/logs/writer.ts`).
- **Feature d'une erreur automatique** : déduite de la page d'où vient l'action (`src/lib/logs/paths.ts`). Une nouvelle page de feature doit y être ajoutée, sinon ses erreurs sont classées « Inconnue ».

## À ne jamais logger

Le `context` passe par `sanitizeLogContext` (`src/lib/logs/sanitize.ts`) : les clés contenant `password`, `secret`, `token`, `authorization`, `cookie` ou `apiKey` sont masquées, les chaînes coupées à 2 000 caractères, le tout limité à ~16 Ko. Malgré ça, ne pas mettre dans `context` de secret sous un autre nom, ni de gros contenus (HTML collé, fichiers) : résumer (taille, nombre, ids). Le corps d'une requête du bot refusée par le secret (401) n'est jamais lu.

## Rétention

90 jours (`APP_LOG_RETENTION_DAYS`, `src/lib/logs/retention.ts`). La purge tourne au démarrage du serveur puis toutes les 24 h (`src/instrumentation.ts`, qui enregistre aussi le logger des erreurs automatiques).
