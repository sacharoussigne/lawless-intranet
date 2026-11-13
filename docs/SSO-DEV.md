# SSO Development Setup

## Hosts: `*.lawless.localhost`

Browsers refuse a cookie with `Domain=.localhost` set from a subdomain (`localhost` counts as a top-level domain), which breaks the Discord login with a `state_mismatch`. To share the session between hosts (auth, business, shelter…), use one more level: **`*.lawless.localhost`**.

- auth: `AUTH_COOKIE_DOMAIN=.lawless.localhost`, `BETTER_AUTH_URL` and `NEXT_PUBLIC_AUTH_URL` = `http://auth.lawless.localhost:3001`. Apps on its subdomains are trusted automatically (`getTrustedOrigins`).
- business: `NEXT_PUBLIC_AUTH_URL=http://auth.lawless.localhost:3001`, `NEXT_PUBLIC_APP_URL=http://business.lawless.localhost:3000`, `BUSINESS_TYPE_HOSTS=DISPENSARY=dispensary.lawless.localhost:3000`.
- The Next configs list `*.lawless.localhost` in `allowedDevOrigins` (otherwise pages do not hydrate).
- Chrome resolves `*.localhost` to 127.0.0.1 by itself. Other browsers may need hosts entries:

```
127.0.0.1 auth.lawless.localhost
127.0.0.1 business.lawless.localhost
127.0.0.1 dispensary.lawless.localhost
127.0.0.1 gs.lawless.localhost
127.0.0.1 shelter.lawless.localhost
```

On Windows, edit `C:\Windows\System32\drivers\etc\hosts` as administrator. Use these hostnames in the browser (not `127.0.0.1`) so the shared session cookie works.

Without sharing between hosts, running everything on `localhost:<port>` is enough.

## Apps

| App | URL | Port |
|-----|-----|------|
| auth (IdP) | http://auth.lawless.localhost:3001 | 3001 |
| business (every business; dispensaries and general stores on their own host via `BUSINESS_TYPE_HOSTS`) | http://business.lawless.localhost:3000, http://dispensary.lawless.localhost:3000, http://gs.lawless.localhost:3000 | 3000 |
| shelter | http://shelter.lawless.localhost:3006 | 3006 |
| documents (API) | http://localhost:3002 | 3002 |
| agenda (API) | http://localhost:3003 | 3003 |
| bank (API) | http://localhost:3004 | 3004 |
| inventory (API) | http://localhost:3005 | 3005 |
| media (API, server-side only) | http://localhost:3009 | 3009 |
| realtime (WebSocket) | ws://localhost:3007 (internal: http://localhost:3008) | 3007 / 3008 |

Production URLs: `docs/URLS.md`.

## Environment

1. Copy each `apps/<app>/.env.example` to `apps/<app>/.env` (auth, business, shelter, documents, agenda, bank, inventory, media).
2. Shared secrets (same value on both sides):
   - `AUTH_INTERNAL_SECRET`: auth + business
   - `AGENDA_INTERNAL_SECRET`: agenda + business (admin agenda operations)
   - `DOCUMENTS_INTERNAL_SECRET`: documents + business + shelter
   - `BANK_INTERNAL_SECRET` / `BANK_BOT_API_SECRET`: bank + business + shelter
   - `INVENTORY_INTERNAL_SECRET`: inventory + business
   - `MEDIA_INTERNAL_SECRET`: media + business + shelter
3. One PostgreSQL database per app (`DATABASE_URL` in each `.env`): auth, business (no user/session tables), shelter, documents, agenda, bank, inventory, media.
4. Point the hosts at the services: `DOCUMENTS_URL=http://localhost:3002`, `AGENDA_URL=http://localhost:3003`, `BANK_URL=http://localhost:3004`, `INVENTORY_URL=http://localhost:3005`, `MEDIA_URL=http://localhost:3009` (shelter: bank, documents and media only).
5. In auth `.env`, set `SHELTER_URL` / `NEXT_PUBLIC_SHELTER_URL` to `http://shelter.lawless.localhost:3006`.
6. Media library: dev S3 bucket in `apps/media/.env`, see `docs/MEDIA.md`.
7. Realtime websocket (every live update): started by `pnpm dev`, no configuration needed in dev. Outside production, realtime and its publishers / token issuers default to `localhost:3007` / `localhost:3008` and a shared dev secret; set the `REALTIME_*` variables only to override them (they are required in production).

## Discord OAuth

Register the redirect URI: `http://auth.lawless.localhost:3001/api/auth/callback/discord`

## Run

```bash
pnpm install
pnpm dev
```

Login flow: business redirects unauthenticated users to auth, then back with the session cookie shared on `.lawless.localhost`.

Session cookies use the custom Better Auth prefix `lawless-intranet` (e.g. `lawless-intranet.session_token`), not the default `better-auth.*`, so they do not collide with other apps on the same cookie domain.
