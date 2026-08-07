# API HTTP — Banque planifiée (bot / n8n)

Cette API matérialise les occurrences **en attente** des transactions planifiées d’un dispensaire pour un jour donné (Europe/Paris). Destinée à un cron n8n (ex. tous les jours à 2h).

Elle est **distincte** de l’auth utilisateur : clé secrète partagée + `dispensaryId`.

## URL

`POST /api/dispensary/bank/bot/materialize-planned`

Base = URL publique de l’app dispensary (`NEXT_PUBLIC_API_URL`).

## Authentification

| En-tête / paramètre | Obligatoire | Description |
|---------------------|-------------|-------------|
| `Authorization` | Oui | `Bearer <DISPENSARY_BOT_API_SECRET>` |
| `X-Dispensary-Id` | Oui | UUID du dispensaire (ou `?dispensaryId=`) |
| `date` (query) | Non | Jour cible `YYYY-MM-DD` (défaut = aujourd’hui Paris) |

## Comportement

Pour chaque `BankPlannedTransaction` **active** du dispensaire :

- **ONCE** : si `onceDate` = jour cible
- **WEEKLY** : si le jour de semaine Paris (1=lundi … 7=dimanche) est dans `weekdays`

Si aucune occurrence n’existe encore pour `(plannedId, date)` → crée une occurrence `PENDING`.

Ne crée **pas** de transaction dans le livre : confirmation humaine dans l’UI banque.

## Réponse succès

```json
{
  "status": 200,
  "data": {
    "date": "2026-08-08",
    "created": [ /* occurrences créées + plannedTransaction */ ],
    "alreadyPending": [ /* déjà PENDING ce jour */ ],
    "createdCount": 1,
    "alreadyPendingCount": 0
  }
}
```

## Erreurs

| Code | Cas |
|------|-----|
| 400 | `dispensaryId` / date invalide |
| 401 | Secret invalide |
| 403 | Feature banque désactivée |
| 404 | Dispensaire inconnu |
