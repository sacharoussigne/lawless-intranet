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

Optional root `.env` for one-shot migration scripts:

| Variable | Role |
|----------|------|
| `OLD_DISPENSARY_DATABASE_URL` | Legacy mono-app DB backup (still has `user` / `account` tables) |
| `AUTH_DATABASE_URL` | Target auth DB |
| `DISPENSARY_DATABASE_URL` | Current dispensary DB (orphan check after migration) |

## Migration from legacy single-DB setup

**Order matters.** User IDs in dispensary data must match auth user IDs.

### Fresh split (prod or local, auth tables still in source DB)

```bash
# 1. Create auth schema
cd apps/auth && pnpm db:migrate

# 2. Copy users (preserves IDs)
pnpm migrate:users-to-auth

# 3. Remove local auth tables from dispensary
cd apps/dispensary && pnpm db:migrate
```

### Local recovery (dispensary already migrated, backup available)

If `remove_local_auth_tables` was already applied on the dispensary DB, point the script at a backup that still contains auth tables:

```bash
# Root .env example:
# OLD_DISPENSARY_DATABASE_URL=postgresql://.../dispensaire
# AUTH_DATABASE_URL=postgresql://.../lawless_auth
# DISPENSARY_DATABASE_URL=postgresql://.../lawless_dispensary

cd apps/auth && pnpm db:migrate
pnpm migrate:users-to-auth
# Re-run with --reset-auth if test users were created in auth first:
# pnpm migrate:users-to-auth -- --reset-auth
```

Explicit env vars (without root `.env`):

```bash
SOURCE_DATABASE_URL=postgresql://...legacy \
AUTH_DATABASE_URL=postgresql://...auth \
pnpm migrate:users-to-auth
```

## Discord OAuth

Register redirect URI: `http://auth.localhost:3001/api/auth/callback/discord`

## Run

```bash
pnpm install
pnpm dev
```

Login flow: dispensary redirects unauthenticated users to auth, then back with shared `.localhost` session cookie.

Session cookies use the custom Better Auth prefix `lawless-intranet` (e.g. `lawless-intranet.session_token`), not the default `better-auth.*`, so they do not collide with other apps on the same cookie domain.
