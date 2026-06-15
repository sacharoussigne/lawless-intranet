#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ] && [ -f "prisma/schema.prisma" ]; then
  echo "Running prisma migrate deploy..."
  pnpm exec prisma migrate deploy
fi

exec "$@"
