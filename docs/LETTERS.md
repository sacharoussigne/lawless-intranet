# Lettres (boîtes aux lettres)

Archive des lettres RP reçues et envoyées, rangées par correspondant, pour les retrouver et y répondre sans les avoir sur soi. Module `letters` de l'app business (activable dans Admin › Réglages).

## Modèle (`apps/business/prisma/schema.prisma`)

- `LetterBox` : une boîte par personne, créée par un admin (Admin › Boîtes aux lettres).
- `LetterBoxMember` : liste d'accès de la boîte (`OWNER`, `WRITE`, `READ`), comme le cabinet. Le propriétaire choisit qui lit ou écrit. Une boîte garde toujours au moins un propriétaire.
- `LetterCorrespondent` : les contacts **d'une boîte**. `lastLetterAt` est tenu à jour à chaque écriture, pour trier la liste de gauche sans agrégat.
- `Letter` :
  - `direction` (`RECEIVED` / `SENT`), `title`, `transcript`, `letterDate` (date réelle, affichée en RP) ;
  - `replyToId` : la lettre à laquelle elle répond, comme une réponse Discord ;
  - `archivedAt` : retire la lettre du fil sans la supprimer ;
  - `serial` : numéro de série unique dans la boîte, à écrire sur la lettre papier pour la retrouver dans un coffre (`lib/letters/serial.ts`). Il commence par les initiales du correspondant au moment de l'ajout (« George Montgomery » donne `GM-7K3Q9P` ; un seul mot donne ses 2 premières lettres ; `LT` si le nom n'a pas de lettre). Il ne change jamais, même si on renomme le correspondant ou qu'on déplace la lettre.
- `LetterImage` : images d'une lettre, dans l'ordre des pages. Le fichier vit dans le service média.

## Accès

- Pas de permission par rôle : le toggle de la feature, puis la liste des membres de la boîte (`lib/letters/access.ts`, `requireLetterBoxAccess`).
- Les admins de l'entreprise créent les boîtes et gèrent leurs accès (`canManageLetterBoxMembers`). Ils ne lisent pas une boîte sans en être membres.
- Les actions sont dans `app/_actions/letters/*` : chaque mutation est enveloppée par `loggedAction`. Les lectures partagées sans garde sont dans `lib/letters/queries.ts`, jamais dans un fichier `'use server'`.

## Images

- Elles sont stockées dans le service média, dans un **scope à part** (`business-letters:<businessId>`, `lib/letters/media.ts`). La médiathèque ne liste que le scope `business` : les lettres n'y apparaissent jamais.
- Envoi : ticket (`requestLetterImageUpload`), puis POST direct vers S3 (`uploadToPresignedPost` de media-ui), puis `completeLetterImageUpload`. L'enregistrement de la lettre n'envoie que les ids, vérifiés par `checkLetterImages`.
- Affichage : `POST /api/files/by-ids` du service média (`getMediaFilesByIds`) signe les aperçus de toute une page de lettres en un seul appel. La conversation se recharge toutes les 30 min (les liens expirent au bout d'1 h).
- Suppression d'une lettre ou d'une boîte : ses fichiers sont supprimés. Suppression de l'entreprise : le scope est purgé.
- Visionneuse : `MediaViewer` de media-ui, avec le transcript en panneau latéral (`aside`).

## Interface (`employee/letters`)

- Contacts à gauche, conversation à droite : les lettres reçues à gauche, les envoyées à droite. L'URL (`?box=&c=`) garde la boîte et le correspondant.
- On ajoute une lettre **depuis une conversation**, avec sa barre de message (`LetterComposer`) : on colle (Ctrl/Cmd + V) ou glisse plusieurs captures, réordonnées en les faisant glisser, et un seul transcript. Les images partent au stockage aussitôt.
- À l'envoi (bouton ou Ctrl/Cmd + Entrée), une petite modale (`LetterSendModal`) demande le nom de la lettre (titre proposé), reçue ou envoyée, et sa date RP.
- « Répondre » met la lettre en citation au-dessus de la barre, comme Discord. Modifier une lettre passe par `LetterFormModal`.
- Un brouillon laissé en changeant de conversation : ses images sont supprimées du stockage.
- Recherche dans la conversation (titre, transcript, n° de série), et recherche globale de la boîte (Ctrl/Cmd + K), qui ouvre la conversation sur la lettre.
- La recherche ignore la casse et les accents (« elise » trouve « Élise ») : les colonnes `Letter.searchText` (titre + transcript) et `LetterCorrespondent.searchName` gardent une copie normalisée (`normalizeLetterSearch`, `lib/letters/search.ts`), écrite à chaque création ou modification. Pas d'extension Postgres `unaccent`.

## Recherche par le sens

La recherche globale (Ctrl/Cmd + K) montre, sous les résultats exacts, les lettres **proches par le sens** : « il veut un oiseau » trouve « veut oieau ».

- Modèle local `Xenova/multilingual-e5-small` (transformers.js, ONNX runtime natif) : rien ne sort du serveur. Téléchargé (~120 Mo) au premier usage dans `LETTERS_EMBEDDINGS_CACHE_DIR` (volume `business-models` en prod), puis gardé en mémoire. Le premier chargement prend ~20 s : pendant ce temps, la recherche ne renvoie que les résultats exacts (délai de 2 s).
- Vecteurs (384 dimensions) dans `letter.embedding` (**pgvector**, index HNSW cosinus), avec `embedding_model`. Prisma ne lit pas cette colonne : écriture et voisins en SQL brut paramétré (`lib/letters/embeddings.ts`, helpers purs dans `semantic.ts`).
- Calcul après la réponse (`after()`) : à l'ajout ou à la modification d'une lettre, au renommage d'un correspondant (son nom fait partie du texte), et à chaque recherche pour les lettres de la boîte encore sans vecteur (rattrapage, par lots de 32). Changer de modèle : modifier `LETTER_EMBEDDING_MODEL`, les vecteurs se recalculent seuls.
- Scores e5 serrés (≈ 0,78–0,86) : on garde les voisins ≥ 0,80 et à moins de 0,03 du meilleur (`pickSemanticMatches`), 6 au plus.
- Image business sur `node:…-bookworm-slim` (argument `RUNNER_IMAGE` du `Dockerfile`) : l'ONNX runtime n'existe pas pour musl/alpine.
- **Prérequis** : pgvector sur la base business (voir `docs/DOCKER.md`). `LETTERS_SEMANTIC_SEARCH=false` coupe la fonctionnalité ; en cas d'erreur du modèle, la recherche exacte répond seule.

## Temps réel

- Topic `letterbox:<boxId>`, donné dans le jeton aux membres de la boîte (`lib/realtime/token.ts`).
- Chaque mutation publie `emitLetterBoxChanged` (domaine `letters`), sans écho pour l'auteur. Le client invalide les requêtes de la boîte (`useLettersRealtime`).
- Un accès ajouté pendant qu'une personne est connectée ne lui arrive qu'au prochain jeton.

## V2 (pas encore fait)

- **Bot Discord**, en s'appuyant sur les routes bot existantes (`withBotRouteLog`) et limité aux boîtes dont le membre Discord est membre (lien SSO de `Person`) :
  - `/lettre chercher <texte>` : par n° de série, titre ou correspondant, avec un lien vers la lettre dans l'intranet ;
  - `/lettre ajouter` : image en pièce jointe, correspondant, titre. Le bot répond avec le n° de série.
- Pistes :
  - OCR du transcript depuis l'image ;
  - export PDF d'une conversation ;
  - déplacer une lettre vers un autre correspondant depuis la bulle ;
  - pagination de la conversation au-delà des 300 dernières lettres.
