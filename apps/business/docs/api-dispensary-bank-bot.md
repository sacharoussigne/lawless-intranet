# API bot — matérialisation des transactions planifiées

`POST /api/dispensary/bank/bot/materialize-planned`

Proxy dispensary → service `apps/bank` (`BANK_URL/api/bot/materialize-planned`).

## Auth

- `Authorization: Bearer <DISPENSARY_BOT_API_SECRET>` (côté dispensary)
- Header `X-Dispensary-Id: <uuid>`
- Le proxy envoie ensuite `BANK_BOT_API_SECRET` au service bank

## Query

- `?date=YYYY-MM-DD` (optionnel, défaut = aujourd’hui Europe/Paris)

## Direct bank (sans proxy)

`POST http://localhost:3004/api/bot/materialize-planned`

- `Authorization: Bearer <BANK_BOT_API_SECRET>`
- `X-Scope-Id: <dispensaryUuid>` (ou `X-Dispensary-Id`)
- `X-Scope-Type: dispensary` (défaut)
