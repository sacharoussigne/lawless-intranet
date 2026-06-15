#!/bin/sh
set -e

APP_DIR="/app/apps/${APP_NAME}"

if [ -n "$DATABASE_URL" ] && [ -f "${APP_DIR}/prisma/schema.prisma" ]; then
  echo "Running prisma migrate deploy..."
  cd "${APP_DIR}"
  /prisma-tools/node_modules/.bin/prisma migrate deploy
fi

echo "Starting Next.js on port ${PORT:-3000}..."
cd "${APP_DIR}"
exec node server.js
