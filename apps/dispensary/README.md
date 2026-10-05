# dispensary

Staff panel for RP dispensaries (default tenant: Saint-Denis), part of the **lawless-intranet** monorepo. Each dispensary is a tenant reachable at `/d/[dispensarySlug]`, with its own members, permissions and feature toggles.

Authentication is delegated to the `auth` app (SSO). Agenda, bank, documents and inventory data live in their own services, which this app calls through the `@lawless-intranet/*-client` packages.

## Features

Each feature can be toggled per dispensary (**Admin → Settings**).

- **Stock** — items, chests, stock levels, movements, statistics and crafting recipes.
- **Orders** — orders linked to companies and catalog items.
- **Sales** — sales tracking.
- **Bank** — weekly ledger and planned transactions (via the `bank` service).
- **Search** — item catalog search.
- **Mails** — mail templates and patient mail workflows (via the `documents` service).
- **Agenda** — calendars and todo lists (via the `agenda` service).
- **Cabinet** — configurable patient records and forms.
- **Weekly activity / Payroll** — weekly staff activity (also fed by a Discord bot) and payroll reports.
- **Management** (`/d/[slug]/management`) — companies, company groups, categories, items, chests, mail templates.
- **Admin** (`/d/[slug]/admin`) — members, roles and permissions, settings, agendas, cabinets, stock overrides, payroll.
- **Platform** (`/platform`) — platform admins manage dispensaries and users.

## Development

From the monorepo root:

```bash
pnpm install
cp apps/dispensary/.env.example apps/dispensary/.env   # then fill in the values
pnpm --filter dispensary db:migrate
pnpm dev            # runs all apps; the auth app and the services are required
```

Open http://dispensary.localhost:3000. The `*.localhost` hosts are required for the SSO cookies; see [`docs/SSO-DEV.md`](../../docs/SSO-DEV.md).

Useful scripts:

```bash
pnpm --filter dispensary typecheck
pnpm --filter dispensary lint
pnpm --filter dispensary test        # Vitest
```

## Environment variables

See [`.env.example`](.env.example).

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Dispensary PostgreSQL database (no user/session tables) |
| `AUTH_URL`, `NEXT_PUBLIC_AUTH_URL`, `AUTH_INTERNAL_SECRET` | SSO identity provider (`auth` app) |
| `DOCUMENTS_URL`, `DOCUMENTS_INTERNAL_SECRET` | Documents service |
| `AGENDA_URL`, `AGENDA_INTERNAL_SECRET` | Agenda service |
| `BANK_URL`, `BANK_INTERNAL_SECRET`, `BANK_BOT_API_SECRET` | Bank service |
| `INVENTORY_URL`, `INVENTORY_INTERNAL_SECRET` | Inventory service |
| `DISPENSARY_BOT_API_SECRET` | Discord bot API (weekly activity) |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_ENV` | Public URL of this app, `dev` or `prod` |
| `TZ` | Server timezone (e.g. `UTC`) |

Each `*_INTERNAL_SECRET` must have the same value here and in the matching service.

## Further docs

- [`docs/react-query.md`](docs/react-query.md) — client data fetching standard (React Query + server actions)
- [`docs/cabinet-formulaires.md`](docs/cabinet-formulaires.md) — cabinet forms
- [`docs/api-dispensary-bank-bot.md`](docs/api-dispensary-bank-bot.md), [`docs/api-dispensary-weekly-activity-bot.md`](docs/api-dispensary-weekly-activity-bot.md) — bot APIs
- [`docs/DOCKER.md`](../../docs/DOCKER.md) — Docker build and deployment
- [`CLAUDE.md`](../../CLAUDE.md) — architecture and development conventions

## License

[MIT](LICENSE).
