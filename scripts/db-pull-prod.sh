#!/usr/bin/env bash
# Copies the production databases into the local ones (see docs/DB-PULL-PROD.md).
#
#   pnpm db:pull-prod                      # every database: dump prod, wipe local, restore, migrate
#   pnpm db:pull-prod --only auth,bank     # a subset
#   pnpm db:pull-prod --dump-only          # only write the .sql files
#   pnpm db:pull-prod --from .db-dumps/20261015-190000   # restore existing dumps (no prod access)
#   options: --yes (no confirmation), --no-migrate (skip pnpm db:migrate:deploy)
#
# Prod credentials: .env.prod (PROD_<APP>_DATABASE_URL). Local targets: apps/<app>/.env (DATABASE_URL).
# Prod is only read (pg_dump in a read-only transaction). Only localhost databases are ever dropped.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ALL_APPS="auth business shelter documents agenda bank inventory media"
PROD_ENV_FILE="${PROD_ENV_FILE:-$ROOT/.env.prod}"
DUMPS_DIR="$ROOT/.db-dumps"
KEEP_DUMPS=5

APPS="$ALL_APPS"
DUMP_ONLY=0
FROM_DIR=""
ASSUME_YES=0
MIGRATE=1

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '\033[33m⚠ %s\033[0m\n' "$*" >&2; }
die() { printf '\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

usage() { sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --only) [ $# -ge 2 ] || die "--only attend une liste (ex. --only auth,bank)"; APPS="$(echo "$2" | tr ',' ' ')"; shift 2 ;;
    --dump-only) DUMP_ONLY=1; shift ;;
    --from) [ $# -ge 2 ] || die "--from attend un dossier de dumps"; FROM_DIR="$2"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --no-migrate) MIGRATE=0; shift ;;
    -h|--help) usage 0 ;;
    *) warn "Option inconnue : $1"; usage 1 ;;
  esac
done

# Former name of the business app.
APPS="$(for app in $APPS; do if [ "$app" = dispensary ]; then echo business; else echo "$app"; fi; done | xargs)"

[ "$DUMP_ONLY" = 1 ] && [ -n "$FROM_DIR" ] && die "--dump-only et --from sont incompatibles"
for app in $APPS; do
  case " $ALL_APPS " in *" $app "*) ;; *) die "Base inconnue : $app (connues : $ALL_APPS)" ;; esac
done
command -v docker >/dev/null || die "docker est requis (pg_dump et psql tournent dans des conteneurs)"
command -v node >/dev/null || die "node est requis"

# --- Helpers -----------------------------------------------------------------

# Value of KEY in a dotenv file (dotenv parsing: quotes, comments), empty if missing.
env_get() {
  node -e '
    const fs = require("fs");
    const [file, key] = process.argv.slice(1);
    if (!fs.existsSync(file)) process.exit(0);
    const value = require("dotenv").parse(fs.readFileSync(file))[key];
    if (value) process.stdout.write(value);
  ' "$1" "$2"
}

# Part of a postgres URL: host, port, user, password, database (decoded).
url_part() {
  node -e '
    const [raw, part] = process.argv.slice(1);
    const url = new URL(raw);
    const values = {
      host: url.hostname,
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    };
    process.stdout.write(values[part] ?? "");
  ' "$1" "$2"
}

# Same URL without the Prisma-only `schema` query parameter, and reachable from a container.
container_url() {
  node -e '
    const url = new URL(process.argv[1]);
    url.searchParams.delete("schema");
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) url.hostname = "host.docker.internal";
    process.stdout.write(url.toString());
  ' "$1"
}

upper() { echo "$1" | tr '[:lower:]' '[:upper:]'; }
# The business app keeps its historical env name (PROD_DISPENSARY_DATABASE_URL).
prod_env_name() { if [ "$1" = business ]; then echo DISPENSARY; else upper "$1"; fi; }
prod_url() { env_get "$PROD_ENV_FILE" "PROD_$(prod_env_name "$1")_DATABASE_URL"; }
local_url() { env_get "$ROOT/apps/$1/.env" DATABASE_URL; }
human_size() { du -h "$1" | cut -f1 | tr -d ' '; }

is_local_host() {
  case "$1" in localhost|127.0.0.1|::1) return 0 ;; *) return 1 ;; esac
}

# --- Checks (before anything is read or written) -----------------------------

SELECTED=""
for app in $APPS; do
  lurl="$(local_url "$app")"
  [ -n "$lurl" ] || { warn "$app : pas de DATABASE_URL dans apps/$app/.env, ignorée"; continue; }
  if [ -z "$FROM_DIR" ]; then
    [ -f "$PROD_ENV_FILE" ] || die ".env.prod introuvable : copier .env.prod.example et y mettre les accès de prod"
    purl="$(prod_url "$app")"
    [ -n "$purl" ] || { warn "$app : pas de PROD_$(prod_env_name "$app")_DATABASE_URL dans .env.prod, ignorée"; continue; }
    if [ "$(url_part "$purl" host):$(url_part "$purl" port)/$(url_part "$purl" database)" = \
         "$(url_part "$lurl" host):$(url_part "$lurl" port)/$(url_part "$lurl" database)" ]; then
      die "$app : l'URL de prod est identique à l'URL locale, arrêt"
    fi
  fi
  if [ "$DUMP_ONLY" = 0 ]; then
    lhost="$(url_part "$lurl" host)"
    is_local_host "$lhost" || die "$app : la base locale n'est pas sur localhost ($lhost). On ne vide jamais une base distante."
  fi
  SELECTED="$SELECTED $app"
done
SELECTED="${SELECTED# }"
[ -n "$SELECTED" ] || die "Aucune base à traiter"

# Major version of the server behind a URL (psql runs in a container).
server_major() {
  local version
  version="$(docker run --rm postgres:17-alpine psql "$(container_url "$1")" -Atc 'show server_version_num' 2>/dev/null)" \
    || return 1
  echo $((version / 10000))
}

LOCAL_MAJOR=""
if [ "$DUMP_ONLY" = 0 ]; then
  LOCAL_MAJOR="$(server_major "$(local_url "${SELECTED%% *}")")" \
    || die "Connexion à la base locale impossible (Postgres local démarré ?)"
fi

START_TIME=$(date +%s)

# --- 1. Dump prod ------------------------------------------------------------

if [ -n "$FROM_DIR" ]; then
  DUMP_DIR="$(cd "$FROM_DIR" 2>/dev/null && pwd)" || die "Dossier introuvable : $FROM_DIR"
  for app in $SELECTED; do
    [ -s "$DUMP_DIR/$app.sql" ] || die "$app : $DUMP_DIR/$app.sql introuvable ou vide"
  done
  # Restore with the psql of the pg_dump that wrote the files (newer dumps use newer meta-commands).
  PG_MAJOR="$(grep -m1 -oE 'Dumped by pg_dump version [0-9]+' "$DUMP_DIR/${SELECTED%% *}.sql" | grep -oE '[0-9]+$')" \
    || die "Version de pg_dump introuvable dans l'en-tête des dumps"
  PG_IMAGE="postgres:$PG_MAJOR-alpine"
  bold "Dumps existants : ${DUMP_DIR#"$ROOT"/}"
else
  DUMP_DIR="$DUMPS_DIR/$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$DUMP_DIR"
  chmod 700 "$DUMPS_DIR" "$DUMP_DIR"

  PG_MAJOR="$(server_major "$(prod_url "${SELECTED%% *}")")" \
    || die "Connexion à la base de prod impossible (vérifier .env.prod, le réseau ou le VPN)"
  PG_IMAGE="postgres:$PG_MAJOR-alpine"

  bold "Dump de la prod (PostgreSQL $PG_MAJOR, lecture seule) → ${DUMP_DIR#"$ROOT"/}"
  for app in $SELECTED; do
    url="$(container_url "$(prod_url "$app")")"
    printf '  %-11s … ' "$app"
    docker run --rm -e PGOPTIONS='-c default_transaction_read_only=on' "$PG_IMAGE" \
      pg_dump --no-owner --no-privileges "$url" >"$DUMP_DIR/$app.sql" \
      || { echo; die "$app : pg_dump a échoué"; }
    chmod 600 "$DUMP_DIR/$app.sql"
    echo "$(human_size "$DUMP_DIR/$app.sql")"
  done

  # Keep the last dumps only.
  ls -1d "$DUMPS_DIR"/*/ 2>/dev/null | sort -r | tail -n +$((KEEP_DUMPS + 1)) | while read -r old; do
    rm -rf "$old"
  done
fi

if [ "$DUMP_ONLY" = 1 ]; then
  bold "Terminé (dumps uniquement) en $(( $(date +%s) - START_TIME )) s"
  exit 0
fi

# --- 2. Confirmation ---------------------------------------------------------

if [ "$PG_MAJOR" -gt "$LOCAL_MAJOR" ]; then
  warn "Dumps de PostgreSQL $PG_MAJOR, serveur local en $LOCAL_MAJOR : la restauration peut échouer"
fi

echo
bold "Les bases locales suivantes vont être SUPPRIMÉES puis remplacées :"
for app in $SELECTED; do
  lurl="$(local_url "$app")"
  info "$(printf '%-11s %s:%s/%s  ←  %s' "$app" "$(url_part "$lurl" host)" "$(url_part "$lurl" port)" \
    "$(url_part "$lurl" database)" "$(human_size "$DUMP_DIR/$app.sql")")"
done
warn "Couper « pnpm dev » avant de continuer : les apps se reconnecteraient pendant l'import."
if [ "$ASSUME_YES" = 0 ]; then
  printf 'Taper « oui » pour continuer : '
  read -r answer
  [ "$answer" = "oui" ] || die "Annulé, rien n'a été modifié en local"
fi

# --- 3. Restore locally ------------------------------------------------------

# psql of the dump's version, against a database of the local server.
local_psql() {
  local lurl="$1" database="$2"
  shift 2
  docker run --rm -i -e PGPASSWORD="$(url_part "$lurl" password)" -e PGOPTIONS="-c client_min_messages=warning" "$PG_IMAGE" \
    psql -X -q -v ON_ERROR_STOP=1 -h "$(url_part "$(container_url "$lurl")" host)" -p "$(url_part "$lurl" port)" \
    -U "$(url_part "$lurl" user)" -d "$database" "$@"
}

echo
bold "Restauration locale (psql $PG_MAJOR)"
for app in $SELECTED; do
  lurl="$(local_url "$app")"
  database="$(url_part "$lurl" database)"
  case "$database" in *[!A-Za-z0-9_]*|"") die "$app : nom de base inattendu « $database »" ;; esac
  printf '  %-11s … ' "$app"
  local_psql "$lurl" postgres -c "DROP DATABASE IF EXISTS \"$database\" WITH (FORCE)" >/dev/null
  local_psql "$lurl" postgres -c "CREATE DATABASE \"$database\"" >/dev/null
  local_psql "$lurl" "$database" <"$DUMP_DIR/$app.sql" >/dev/null \
    || { echo; die "$app : la restauration a échoué (base locale $database incomplète)"; }
  echo "ok"
done

# --- 4. Migrations of the current branch -------------------------------------

if [ "$MIGRATE" = 1 ]; then
  echo
  bold "Migrations en attente de la branche courante (pnpm db:migrate:deploy)"
  migrate_log="$(mktemp)"
  if ! pnpm db:migrate:deploy >"$migrate_log" 2>&1; then
    cat "$migrate_log" >&2
    rm -f "$migrate_log"
    die "pnpm db:migrate:deploy a échoué"
  fi
  rm -f "$migrate_log"
  info "ok"
fi

echo
bold "Terminé en $(( $(date +%s) - START_TIME )) s : $SELECTED"
info "Dumps : ${DUMP_DIR#"$ROOT"/}"
