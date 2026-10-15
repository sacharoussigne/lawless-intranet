# Copier les bases de prod en local

`pnpm db:pull-prod` (`scripts/db-pull-prod.sh`) lit les bases de prod, écrit un `.sql` par base, **supprime les bases locales** et les recharge avec ces données, puis applique les migrations de la branche courante.

## Mise en place

1. Copier `.env.prod.example` en `.env.prod` (ignoré par Git) et y mettre une URL par base (`PROD_<APP>_DATABASE_URL`). Une base sans URL est ignorée.
2. Docker doit tourner : `pg_dump` et `psql` s'exécutent dans des conteneurs `postgres:<version>-alpine`, rien à installer.
3. Les cibles locales sont lues dans `apps/<app>/.env` (`DATABASE_URL`).

## Utilisation

```bash
pnpm db:pull-prod                          # toutes les bases
pnpm db:pull-prod --only auth,dispensary   # quelques bases
pnpm db:pull-prod --dump-only              # uniquement les .sql, rien n'est touché en local
pnpm db:pull-prod --from .db-dumps/20261015-191207   # recharger des dumps existants, sans accès à la prod
pnpm db:pull-prod --yes --no-migrate       # sans confirmation, sans db:migrate:deploy
```

Couper `pnpm dev` avant : les connexions sont coupées (`DROP DATABASE … WITH (FORCE)`), mais les apps se reconnecteraient pendant l'import.

## Garde-fous

- La prod est lue en **lecture seule** : `pg_dump` tourne dans une transaction `default_transaction_read_only`.
- Seules des bases sur `localhost` / `127.0.0.1` sont supprimées. Si une `DATABASE_URL` locale pointe ailleurs, le script s'arrête avant toute action.
- Il s'arrête aussi si une URL de prod est identique à une URL locale.
- La suppression demande de taper `oui` (sauf `--yes`).
- Le `pg_dump` utilisé correspond à la version du serveur de prod. La restauration utilise le `psql` de la même version (les dumps récents contiennent des commandes inconnues des `psql` plus anciens).

## Dumps

Dans `.db-dumps/<horodatage>/<app>.sql` (dossier en `700`, fichiers en `600`, ignorés par Git). Le script ne garde que les 5 derniers dossiers. Ils contiennent des **données de prod sensibles** (sessions, comptes Discord OAuth, données des joueurs) : ne jamais les partager ni les committer.

## À savoir

- Les dumps incluent `_prisma_migrations` : après la restauration, `pnpm db:migrate:deploy` n'applique que les migrations de la branche qui ne sont pas encore en prod.
- **Médiathèque** : la base `media` référence des objets du bucket S3 de prod. Les fichiers ne s'affichent en local que si le bucket configuré en local les contient.
- **Sessions** : les sessions de prod sont copiées, mais les cookies de prod ne sont pas valides en local. Il faut se reconnecter.
