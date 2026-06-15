#!/bin/sh
set -e

cd /deploy

if [ -n "$DATABASE_URL" ] && [ -f "prisma/schema.prisma" ]; then
  echo "Running prisma migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy
fi

echo "Starting Next.js on port ${PORT:-3000}..."
exec node ./node_modules/next/dist/bin/next start -p "${PORT:-3000}"
