# API bot — matérialisation des transactions planifiées

`POST /api/dispensary/bank/bot/materialize-planned`

Proxy de l'app business → service `apps/bank` (`BANK_URL/api/bot/materialize-planned`).

## Auth

- `Authorization: Bearer <DISPENSARY_BOT_API_SECRET>` (côté business)
- Header `X-Dispensary-Id: <uuid>`
- Le proxy envoie ensuite `BANK_BOT_API_SECRET` au service bank

## Query

- `?date=YYYY-MM-DD` (optionnel, défaut = aujourd’hui Europe/Paris)

## Direct bank (sans proxy)

`POST http://localhost:3004/api/bot/materialize-planned`

- `Authorization: Bearer <BANK_BOT_API_SECRET>`
- `X-Scope-Id: <uuid de l'entreprise>` (ou `X-Dispensary-Id`)
- `X-Scope-Type: business` (défaut ; le proxy de l'app business l'envoie lui-même)
