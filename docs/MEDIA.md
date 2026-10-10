# Médiathèque (`apps/media`)

Stockage de fichiers façon drive : images et PDF rangés en dossiers, avec renommage, déplacement, suppression, aperçu et téléchargement. La médiathèque est branchée sur le **refuge** et le **dispensaire** : une médiathèque par refuge et une par dispensaire, cloisonnées par `scopeType` / `scopeId` (`shelter:<id>`, `dispensary:<id>`). Le service ne connaît pas les hôtes : chaque hôte vérifie le tenant, la feature et la permission avant de l'appeler.

## Fonctionnement

```
navigateur ──server actions──▶ shelter / dispensary ──HTTP + MEDIA_INTERNAL_SECRET──▶ media:3009 ──▶ S3
     │                                                                      (base lawless_media)
     └──── upload direct (POST présigné) / lecture (GET présigné) ─────────▶ S3
```

- **Le service `media` n'est jamais appelé par le navigateur.**
  - Seule l'app hôte l'appelle, côté serveur, avec le secret interne et le cookie de session.
  - C'est l'app hôte qui vérifie les droits : feature `media` + permission `media:access`. Qui a accès à la médiathèque a tous les droits dessus.
- **Les fichiers ne passent pas par Next.**
  - Le navigateur envoie directement à S3 avec un POST présigné.
  - S3 impose lui-même la clé, le type de contenu et la taille maximale.
  - Ensuite, le service vérifie l'objet (`HeadObject`) avant de le rendre visible.
- **Clé S3** : `<scopeType>/<scopeId>/<uuid>`. Le nom affiché (nom d'origine, ou renommé) est stocké en base. Au téléchargement, il est imposé via `Content-Disposition`.
- **Limites** : images PNG, JPEG, WebP, GIF et PDF, **20 Mo** maximum (réglable avec `MEDIA_MAX_FILE_SIZE_MB`).
- **Sans `S3_BUCKET` / `S3_REGION`**, le service démarre quand même : la navigation marche, l'import et l'aperçu sont désactivés avec un message.

## Temps réel

Chaque modification publie `media:<scopeType>:<scopeId>` sur le serveur WebSocket (`apps/realtime`). Les autres personnes qui ont la médiathèque ouverte voient le changement sans rafraîchir. L'hôte (refuge ou dispensaire) signe le jeton (topic ajouté si la feature et la permission sont actives). Le service publie par le réseau privé `realtime`.

## Imports abandonnés

Quand l'onglet est fermé ou que le réseau coupe avant la finalisation, un import abandonné laisse une ligne `UPLOADING` en base, et parfois un objet orphelin dans S3.
- **Nettoyage automatique** : le service lance le nettoyage au démarrage, puis **toutes les heures** (`src/instrumentation.ts`, sans cron externe). Il supprime les fichiers `UPLOADING` de plus de 24 h, en base puis dans S3. Comme le ticket d'import ne vit que 15 min, aucun import en cours n'est touché.
- **Déclenchement manuel** : `POST /api/maintenance/cleanup-uploads`, avec le header `x-media-internal-secret`. Le service écrit `[media] cleaned N abandoned upload(s)` dans les logs.

## Liens de partage

Clic droit sur un fichier, puis « Copier le lien de partage » : on obtient un lien public qui **n'expire pas**, par exemple pour Discord. Ce lien a la forme `https://<hôte>/partage/<jeton>/<nom>`, sur le domaine du refuge ou du dispensaire selon la médiathèque.
- **Le jeton** fait 192 bits aléatoires et il est stocké sur le fichier (`MediaFile.shareToken`). La partie `<nom>` de l'URL est décorative.
- **À l'ouverture du lien**, la route publique de l'hôte (`app/partage/[token]/[[...name]]`, hors middleware, sans connexion) fait trois choses :
  1. elle résout le jeton via le service (`GET /api/shares/:token`, secret interne) ;
  2. elle vérifie que le fichier appartient bien à un tenant de cet hôte (`scopeType`) et que sa feature `media` est active. Un lien du refuge ouvert sur le domaine du dispensaire renvoie donc 404, et inversement ;
  3. elle redirige (302, `no-store`) vers une URL S3 signée **fraîche**.
- **Le bucket reste privé** : aucun réglage AWS supplémentaire.
- **« Désactiver le lien »** oublie le jeton, et le lien renvoie 404 immédiatement. Repartager le fichier donne un **nouveau** lien. Supprimer le fichier, ou désactiver la feature, coupe aussi le lien.
- **Limite** : Discord peut garder en cache une image déjà affichée. La désactivation coupe le lien, mais pas forcément une copie que Discord aurait déjà gardée.

## Créer le bucket (dev et prod)

Un bucket par environnement, par exemple `lawless-media-dev` et `lawless-media-prod`.

1. **Bucket** : région au choix (par exemple `eu-west-3`, Paris), **Block all public access activé**. Les fichiers ne sont jamais publics, toutes les URLs sont signées.
2. **CORS** (Permissions → CORS). Mettre les origines de l'app hôte :
   ```json
   [
     {
       "AllowedOrigins": [
         "http://localhost:3006",
         "http://localhost:3000",
         "https://refuge.example.com",
         "https://dispensaire.example.com"
       ],
       "AllowedMethods": ["POST", "GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Pour le bucket de dev, `http://localhost:3006` (refuge) et `http://localhost:3000` (dispensaire) suffisent. Si tu ouvres les apps via `shelter.localhost` / `dispensary.localhost`, ajoute aussi ces origines.
3. **Utilisateur IAM** dédié (accès programmatique uniquement), avec cette politique :
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::lawless-media-dev/*"
       },
       {
         "Effect": "Allow",
         "Action": ["s3:ListBucket"],
         "Resource": "arn:aws:s3:::lawless-media-dev"
       }
     ]
   }
   ```
   `ListBucket` ne sert qu'à la purge d'un refuge ou d'un dispensaire supprimé. Il faut une clé d'accès par environnement.

## Dev

1. Créer la base `lawless_media`.
2. Copier `apps/media/.env.example` en `apps/media/.env` :
   - `DATABASE_URL` ;
   - `MEDIA_INTERNAL_SECRET` ;
   - le bucket de dev (`S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
3. Appliquer les migrations : `pnpm db:migrate:deploy` (base media, plus l'option `featureMediaEnabled` du refuge et du dispensaire, et la permission du dispensaire).
4. Dans `apps/shelter/.env` **et** `apps/dispensary/.env` : `MEDIA_URL=http://localhost:3009` et le **même** `MEDIA_INTERNAL_SECRET`.
5. `pnpm dev`, puis ouvrir *Médiathèque* avec le bouton icône du header (à côté de la file d'attente dans le refuge, de l'agenda dans le dispensaire). Le module est réservé aux rôles `admin` et `direction` par défaut ; on peut accorder `media:access` à d'autres via l'écran des permissions. Il se désactive par tenant dans les paramètres (feature `media`).

Vérification rapide : http://localhost:3009/api/health doit afficher `"storageConfigured": true`.

## Prod

Dans le `.env` global du serveur (voir `docker/.env.example`) :
- `MEDIA_DATABASE_URL` ;
- `MEDIA_INTERNAL_SECRET` ;
- `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION`, `MEDIA_AWS_ACCESS_KEY_ID`, `MEDIA_AWS_SECRET_ACCESS_KEY`.

Ensuite, `make deploy`. Le service `media` n'a pas d'hôte public : il n'est joignable que par le refuge et le dispensaire, sur le réseau Docker `media`.

Penser à ajouter les URLs publiques du refuge et du dispensaire dans le **CORS du bucket de prod**.

## Plus tard

- Gérer des droits fins par dossier.
- Relier les fichiers à des modèles de données (par exemple la photo d'un animal), via un sélecteur `MediaPicker` dans `media-ui`. Les `id` de fichiers sont stables.
