# SSO Development Setup

## Hosts

Add to your hosts file (required for SSO cookie sharing on `.localhost`):

```
127.0.0.1 auth.localhost
127.0.0.1 dispensary.localhost
```

On Windows, edit `C:\Windows\System32\drivers\etc\hosts` as administrator.

`pnpm dev` binds to all interfaces on ports 3000/3001; use the hostnames above in the browser (not `127.0.0.1`) so Better Auth `crossSubDomainCookies` work.

## Apps

| App | URL | Port |
|-----|-----|------|
| auth (IdP) | http://auth.localhost:3001 | 3001 |
| dispensary (RP) | http://dispensary.localhost:3000 | 3000 |

## Environment

1. Copy `apps/auth/.env.example` to `apps/auth/.env`
2. Copy `apps/dispensary/.env.example` to `apps/dispensary/.env`
3. Set the same `AUTH_INTERNAL_SECRET` in both apps
4. Configure separate PostgreSQL databases:
   - `DATABASE_URL` in auth → auth DB
   - `DATABASE_URL` in dispensary → dispensary DB (no user/session tables)

## Migration from legacy single-DB setup

```bash
SOURCE_DATABASE_URL=postgresql://...legacy \
AUTH_DATABASE_URL=postgresql://...auth \
pnpm migrate:users-to-auth
```

Then apply dispensary migration:

```bash
cd apps/dispensary && pnpm db:migrate
```

Initialize auth DB:

```bash
cd apps/auth && pnpm db:migrate
```

## Discord OAuth

Register redirect URI: `http://auth.localhost:3001/api/auth/callback/discord`

## Run

```bash
pnpm install
pnpm dev
```

Login flow: dispensary redirects unauthenticated users to auth, then back with shared `.localhost` session cookie.
