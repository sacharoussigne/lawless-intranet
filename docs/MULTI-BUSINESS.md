# Réflexion : une app multi-entreprises (« Business »)

> Document de réflexion : **rien n'est codé**. Il sert à cadrer le chantier avant de démarrer.

## Objectif

Le serveur RP doit pouvoir gérer d'autres commerces que le dispensaire. On commence par le **general store** ; le **saloon** et d'autres types viendront plus tard. Leur gestion ressemble beaucoup à celle d'un dispensaire : stock, ventes, commandes, banque, paie, activité hebdo, agenda, médiathèque.

Pour le refuge, on avait copié `apps/dispensary`, et environ 100 fichiers sont aujourd'hui en double. On ne veut pas recommencer. On veut **une seule app de gestion d'entreprise**, **Business**, qui gère plusieurs **types** d'entreprises. À terme, l'« app dispensaire » disparaît.

## Décisions

| Sujet | Décision |
|---|---|
| Périmètre | Dispensaires et general stores, puis saloons et d'autres types. Le **refuge reste à part** et continue de profiter des packages partagés. |
| Construction | On **fait évoluer `apps/dispensary` sur place**. Les tables, les données, les bots et les liens restent en place, et l'app est renommée à la fin. Il n'y a ni nouvelle app ni migration lourde. |
| Nom et URL principale | L'app s'appelle **Business**, à l'adresse **`business.aerokusu.fr`**. |
| Sous-domaines | **Un sous-domaine par type** : `dispensaire.aerokusu.fr`, `gs.aerokusu.fr`, puis `saloon.aerokusu.fr`. `auth.aerokusu.fr` ne change pas. |
| Chemins | **Pas de préfixe** : `gs.aerokusu.fr/<entreprise>/employee/stock`. Les anciens liens en `/d/…` sont redirigés. |
| Arrivée | Une seule entreprise accessible : on y entre directement. Plusieurs : une **page de choix**. Aucune : une **page d'accueil** qui explique comment obtenir l'accès. |
| Données dans les services | Elles passent à `scopeType: 'business'` **avant** l'arrivée du general store. |
| Profils Discord | Un **profil commun** par personne, partagé entre les entreprises. |
| General store | Pas de cabinet médical. Un rôle par défaut **employé**. Une activité hebdo propre : caisse, présence, **Nourriture** et **Boisson** (consommation personnelle), chacun désactivable dans les réglages. Un **catalogue de prix** réservé aux employés. Un **thème bleu**. |
| Dispensaire | Il garde son **thème vert** et tous ses modules actuels. |

### Pourquoi `business.aerokusu.fr` plutôt que `business.lawless.aerokusu.fr`

Un niveau `lawless.` aurait été logique si on l'appliquait à tout le projet. Mais `dispensaire.aerokusu.fr` serait devenu `dispensaire.lawless.aerokusu.fr`, et `auth.aerokusu.fr` serait devenu `auth.lawless.aerokusu.fr`. Il aurait aussi fallu changer le domaine du cookie SSO et les certificats, et prévenir tous les joueurs.

On n'y gagne rien : la cohabitation avec d'autres apps sur `aerokusu.fr` est déjà assurée par le préfixe du cookie SSO (`lawless-intranet`, voir `docs/DOCKER.md`). On reste donc à plat.

## 1. État actuel

### Les données métier sont déjà génériques

Le stock, les ventes, les commandes, les crafts, la banque, l'agenda, les documents et les médias sont déjà des **services** à part. Ils sont scopés par `scopeType` + `scopeId` (`packages/service-kit/src/scope.ts`). Le dispensaire fixe `scopeType: 'dispensary'` à un seul endroit, `apps/dispensary/src/lib/serviceHost.ts`. Ces services savent donc déjà servir n'importe quel type d'entreprise. Le refuge en est la preuve, avec `scopeType: 'shelter'`.

### Ce que contient `apps/dispensary`

La base de l'app compte 15 modèles :

| Nature | Modèles |
|---|---|
| Génériques | `Dispensary` (le tenant), `DispensaryMember`, `DispensaryRolePermission`, `DispensaryMemberPermission`, `PayrollWeeklyReport`, `DispensaryDiscordProfile`, `UserUiPreferences`, `AppLog` |
| Mixtes | `AppSettings` : les toggles de features sont génériques, mais `dispensaryName` vaut « Saint-Denis » par défaut et les flags `weeklyActivity*Visible` sont médicaux.<br>`DispensaryWeeklyActivity` et son historique : la caisse et la présence sont génériques, mais `patientsCount`, `infusionsCount`, `poppyMilkCount` et `sherifCount` sont médicaux. |
| Médical | `Cabinet`, `CabinetMember`, `CabinetPatient`, `CareEpisode`, `Consultation` |

### Résolution du tenant

- Elle se fait **uniquement par le chemin** `/d/[slug]` (`middleware.ts`, `lib/dispensary/slug.ts`). L'hôte n'est jamais lu.
- `/` (`app/page.tsx`) redirige vers le premier dispensaire accessible. Il n'y a pas de vraie page de choix, seulement un select dans le Header.
- `requireTenantServerActionContext` (`lib/serverActionAuth.ts`) vérifie le tenant, la session, la feature (`AppFeatureKey`, 11 clés) et la permission.
- Les permissions combinent la matrice de rôles du tenant et des surcharges par membre. La matrice par défaut, `DEFAULT_ROLE_MATRIX` (`lib/dispensary/permissionsSeed.ts`), est la même pour tous.

### Spécificités du dispensaire codées en dur

- La ressource de permission `weekly_dispensary_activity`, dans `packages/auth-permissions/src/catalog.ts`.
- Le branding :
  - le titre `%s | Dispensaire` dans `app/layout.tsx` ;
  - le manifest PWA ;
  - le logo `logo_dispensaire.png` ;
  - `dispensarySiteTitle()` dans le Header.
- Environ 77 libellés « dispensaire » répartis dans 41 fichiers d'UI.
- Le préfixe CSS `--disp-*`, et les thèmes « Apothicaire » et « Lampe à huile ».

### Hébergement et SSO

- Le reverse proxy est nginx-proxy, configuré par `VIRTUAL_HOST` et `LETSENCRYPT_HOST` sur chaque conteneur.
- Le cookie SSO a pour domaine `AUTH_COOKIE_DOMAIN`, donc il couvre déjà tout `*.aerokusu.fr`.
- Côté auth, `isAllowedSsoHostname` (`apps/auth/src/lib/ssoHosts.ts`) accepte déjà tout sous-domaine. En revanche, `getTrustedOrigins()` (`apps/auth/src/lib/constants.ts`) liste les origines une par une.

### Bots Discord

Les bots appellent `/api/dispensary/weekly-activity/...` et `/api/dispensary/bank/bot/...`. Ils identifient le dispensaire par son **UUID** (`x-dispensary-id` ou `?dispensaryId=`), jamais par son slug. Ces routes doivent continuer de répondre.

## 2. Modèle cible

### `Business` remplace `Dispensary`

```prisma
enum BusinessType {
  DISPENSARY
  GENERAL_STORE
  // SALOON plus tard
}

model Business {
  id   String       @id
  slug String       @unique
  name String
  type BusinessType @default(DISPENSARY)
  // …
  @@map("dispensary") // table existante : aucune donnée ne bouge
}
```

- On renomme les modèles Prisma, avec des `@@map` / `@map` vers les tables et colonnes existantes. Il n'y a aucun renommage SQL, donc aucun risque pour les données.
- Les autres modèles suivent le même principe : `BusinessMember`, `BusinessRolePermission`, `BusinessMemberPermission`, `WeeklyActivity`, etc.
- La seule vraie migration ajoute la colonne `type`. Le dispensaire existant prend `DISPENSARY`.

### Un registre des types en code

Le registre vit dans `lib/businessTypes/`. C'est la **source unique de tout ce qui varie selon le type** :

```ts
export const businessTypes = {
  DISPENSARY: {
    label: 'Dispensaire',
    labelPlural: 'Dispensaires',
    host: 'dispensaire',            // sous-domaine (configurable par env)
    logo: '/logos/dispensary.png',
    themes: ['apothecary', 'nuit'], // vert, clair et sombre
    modules: ['stock', 'sales', 'orders', 'bank', 'mails', 'payroll',
              'weeklyActivity', 'agenda', 'media', 'search', 'cabinet'],
    defaultRoleMatrix: DISPENSARY_ROLE_MATRIX,
    weeklyCounters: [
      { key: 'patients', label: 'Patients' },
      { key: 'infusions', label: 'Perfusions' },
      { key: 'poppyMilk', label: 'Lait de pavot' },
      { key: 'sheriffs', label: 'Shérifs' },
    ],
  },
  GENERAL_STORE: {
    label: 'General store',
    labelPlural: 'General stores',
    host: 'gs',
    logo: '/logos/general-store.png',
    themes: ['mercantile', 'mercantileNight'], // bleu, clair et sombre
    modules: ['stock', 'sales', 'orders', 'bank', 'mails', 'payroll',
              'weeklyActivity', 'agenda', 'media', 'search', 'priceCatalog'],
    defaultRoleMatrix: GENERAL_STORE_ROLE_MATRIX, // admin + employee
    weeklyCounters: [
      { key: 'food', label: 'Nourriture' },   // consommation personnelle
      { key: 'drink', label: 'Boisson' },     // consommation personnelle
    ],
  },
} satisfies Record<BusinessType, BusinessTypeDefinition>;
```

- **Modules** : chaque type déclare les `AppFeatureKey` qu'il propose. Pour une entreprise donnée, un module est actif s'il est **permis par son type** et **activé** dans ses réglages.
  - `assertAppFeatureEnabledMiddleware` et `requireTenantServerActionContext` vérifient les deux conditions.
  - La page des réglages ne montre que les modules permis.
- **Rôles par défaut** : chaque type a sa matrice, qui remplace le `DEFAULT_ROLE_MATRIX` unique. Le general store démarre avec **admin** et **employé**. Ses permissions précises seront réglées à la conception de la phase concernée.
- **Ajouter le saloon** revient à ajouter une entrée au registre, avec ses modules propres s'il en a.

## 3. Activité hebdo générique

La caisse et la présence sont déjà génériques : elles servent aux deux types sans rien changer. Les autres compteurs, eux, dépendent du type :

| Type | Compteurs propres |
|---|---|
| Dispensaire | patients, perfusions, lait de pavot, shérifs |
| General store | Nourriture, Boisson. Ce sont les consommations personnelles de l'employé ; les boutons portent juste ces mots. |

Les colonnes fixes (`patientsCount`, `infusionsCount`…) et l'enum de l'historique (`INCREMENT_PATIENTS`, `INFUSIONS`, `POPPY_MILK`…) ne peuvent pas servir au general store.

**Proposition** : des compteurs clé/valeur, décrits par le registre du type.

```prisma
model WeeklyActivityCounter {
  activityId String
  key        String // 'patients', 'food'…, défini par le type
  value      Int    @default(0)
  @@id([activityId, key])
}
```

- Une migration de données transforme les colonnes actuelles en lignes. Les flags `weeklyActivity*Visible` deviennent un réglage par compteur.
- L'historique enregistre `{ action: 'INCREMENT_COUNTER', counterKey }` au lieu d'une valeur d'enum par compteur.
- Les routes du bot `caisse` et `presence` ne changent pas. Une route d'incrément prend la clé du compteur en paramètre.

### Activer / désactiver un compteur

- Chaque compteur déclaré par le type a un **réglage d'activation par entreprise**, par exemple `WeeklyActivityCounterSetting { businessId, key, enabled }` ou un JSON dans `AppSettings`. Ce réglage remplace les flags fixes `weeklyActivity*Visible`.
- Dans Admin › Réglages › Activité hebdo, la page liste les compteurs du type avec un interrupteur chacun. Pour le general store : « Nourriture » et « Boisson ».
- Un compteur désactivé disparaît des boutons, du récap et de la paie, mais ses valeurs passées sont conservées. Il suffit de le réactiver pour les retrouver.
- Le dispensaire utilise le même mécanisme : ses flags actuels (patients, perfusions, lait de pavot, shérifs) deviennent ces réglages lors de la migration.

## 4. Routage : hôtes, chemins, arrivée

### Hôte → type

1. Le middleware lit l'en-tête `Host` et en déduit un **filtre de type** :
   - `dispensaire.*` → `DISPENSARY` ;
   - `gs.*` → `GENERAL_STORE` ;
   - `business.*` → aucun filtre.

   La table de correspondance vient de l'env (par exemple `BUSINESS_HOSTS=dispensaire:DISPENSARY,gs:GENERAL_STORE`). En local, on garde ainsi `dispensaire.localhost`, `gs.localhost` et `business.localhost`.
2. Une entreprise ouverte sur un hôte qui ne correspond pas à son type est redirigée en **308** vers le bon hôte, avec le même chemin.

### Chemins sans préfixe

```
dispensaire.aerokusu.fr/saint-denis/employee/stock
gs.aerokusu.fr/valentine/employee/stock
```

- Le dossier de routes `d/[dispensarySlug]/` devient `[businessSlug]/`.
- Toutes les URLs passent déjà par `tenantRoutes(slug)`. Il suffit d'en changer la base, sans toucher aux appelants.
- **Slugs réservés** : un nom d'entreprise ne peut pas reprendre un chemin fixe de l'app. Les slugs interdits sont `platform`, `settings`, `api`, `auth`, `partage`, `_next`, `manifest.webmanifest`, `favicon.ico`… Ils sont vérifiés à la création et à la modification d'un slug, à partir d'une liste unique tenue à côté de `tenantRoutes`.
- **Anciens liens** : `/d/<slug>/…` redirige en 308 vers `/<slug>/…`, et les favoris continuent de marcher. La redirection des anciens chemins sans tenant (`legacyPathToTenant`) est conservée.

### Arrivée sur `/`

On compte les entreprises accessibles, filtrées par le type de l'hôte :

| Nombre | Résultat |
|---|---|
| 0 | **Page d'accueil** : logo de l'app, types d'entreprises existants et message « Vous n'êtes membre d'aucune entreprise : demandez l'accès à votre responsable ». Un admin plateforme y trouve un lien vers `/platform`. |
| 1 | Redirection directe vers l'entreprise. |
| plusieurs | **Page de choix** : cartes groupées par type (logo et nom). Sur `business.aerokusu.fr`, chaque carte mène à l'hôte de son type. |

### Header

Le select actuel devient un switcher qui :
- liste les entreprises de l'utilisateur, groupées par type ;
- envoie vers l'hôte du type choisi ;
- donne accès à la page de choix complète.

## 5. Services, temps réel, bots, permissions

### Bascule `scopeType: 'business'`

- Toutes les entreprises de l'app utilisent `scopeType: 'business'` (l'UUID de l'entreprise reste le `scopeId`).
- Les données existantes du dispensaire sont migrées par un script SQL dans chaque service :

  ```sql
  UPDATE <table> SET scope_type = 'business' WHERE scope_type = 'dispensary';
  ```

  Les services concernés sont inventory, bank, agenda et media. Documents utilise `type` + `scopeId` et est à vérifier.
- C'est **l'étape la plus risquée**, car elle touche plusieurs bases. Elle se fait dans une bascule dédiée, avec une sauvegarde avant et une vérification des comptes de lignes après.
- **Elle passe avant le general store** : il démarre directement avec `'business'`, sans données à rattraper.

### Temps réel

- Les topics `orders:<id>`, `sales:<id>`, `stock:<id>` et `weeklyactivity:<id>` gardent leur forme, avec l'id de l'entreprise. C'est déjà le même UUID.
- Les messages sont éphémères : renommer des topics ne demande aucune migration.

### Bots Discord

- `/api/dispensary/...` et `x-dispensary-id` restent comme **alias**.
- On ajoute `/api/business/...` et `x-business-id`, que le bot du general store utilisera.

### Permissions

- `weekly_dispensary_activity` devient `weekly_activity`. On migre les lignes de rôles et de surcharges par membre.
- Le catalogue de permissions ne montre que les ressources des modules permis par le type. Par exemple, `cabinet` n'apparaît que pour un dispensaire et `price_catalog` que si le module est permis.

## 6. Profils des personnes (Discord)

### Aujourd'hui

`DispensaryDiscordProfile` est propre à **un** dispensaire. Il contient :
- l'ID Discord ;
- le dernier nom reçu et le nom fixé à la main ;
- un rôle ;
- le numéro de compte, qui sert à la paie ;
- le lien vers le compte SSO.

Un joueur qui travaille dans deux entreprises aurait donc deux profils, à tenir à jour en double.

### Cible : un profil commun

```prisma
model Person {                 // l'identité du joueur, partagée
  id               String  @id
  discordUserId    String  @unique
  lastDisplayName  String
  fixedDisplayName String?
  accountNumber    Int?    @unique // son compte bancaire RP, personnel
  userId           String?         // compte SSO lié
}

model BusinessPerson {         // sa place dans une entreprise
  personId   String
  businessId String
  role       String?
  @@id([personId, businessId])
}
```

- La paie, l'activité hebdo et les bots continuent de passer par l'ID Discord. Le premier passage d'un joueur dans une entreprise crée simplement le lien `BusinessPerson`.
- **Migration** : `DispensaryDiscordProfile` est découpé en `Person` + `BusinessPerson`. Aujourd'hui il n'y a qu'un dispensaire, donc aucun conflit à fusionner.
- **Point d'attention** : un nom fixé à la main (Gestion › Personnes) s'applique dans toutes les entreprises. C'est voulu, puisqu'il s'agit du nom du personnage. Les gestionnaires de chaque entreprise peuvent le modifier.

## 7. Catalogue de prix (general store)

- C'est un nouveau module, `priceCatalog`. Il est permis pour le general store et peut l'être plus tard pour les autres types.
- Il est réservé aux **employés connectés**, avec la permission `price_catalog:view`. Il n'y a pas de page publique.
- Il présente une liste de référence des **prix de vente**, groupée par catégorie, avec une recherche. La source est le champ `price` des objets de l'inventaire (`apps/inventory`), qui sert déjà à la vente.
- Il faut voir s'il faut aussi un réglage « visible au catalogue » par objet, pour masquer les objets internes comme les ingrédients.
- Il peut être conçu avec le paquet `inventory-ui`, comme le reste du stock.

## 8. Branding et thèmes

- **Par type** :
  - le logo et le manifest PWA ;
  - le titre (`%s | General store`) ;
  - le nom par défaut ;
  - les thèmes proposés.
- **Dispensaire** : il reste **vert** (« Apothicaire » et « Lampe à huile »).
- **General store** : il aura un **thème bleu**, à concevoir sur le moteur `host-kit/theme`, en clair et en sombre. On peut partir sur une ambiance « mercantile » : bleu de toile et d'enseigne peinte, bois clair, papier d'emballage.
- **Préférence de thème** : `UserUiPreferences.theme` passe à une valeur **par type** (`{ DISPENSARY: 'apothecary', GENERAL_STORE: 'mercantile' }`). Le cookie de thème suit le même principe, si bien qu'un thème vert n'apparaît jamais dans le general store.
- **Variables CSS** : `--disp-*` devient `--biz-*`. C'est un renommage mécanique, à faire en toute fin.

## 9. Déploiement

- Un **seul conteneur** pour l'app, déclaré sur plusieurs hôtes :

  ```env
  VIRTUAL_HOST=business.aerokusu.fr,dispensaire.aerokusu.fr,gs.aerokusu.fr
  LETSENCRYPT_HOST=business.aerokusu.fr,dispensaire.aerokusu.fr,gs.aerokusu.fr
  ```

  nginx-proxy et le compagnon letsencrypt gèrent ces listes nativement.
- **DNS** : ajouter `business` et `gs`. `auth.aerokusu.fr` et le domaine du cookie SSO (`.aerokusu.fr`) ne changent pas.
- **Auth** : autoriser tout `*.<AUTH_COOKIE_DOMAIN>` dans `getTrustedOrigins()`, comme le fait déjà `isAllowedSsoHostname`. On n'aura plus à y toucher à chaque nouveau type.
- **URLs absolues** : `NEXT_PUBLIC_APP_URL` est figé au build, ce qui ne marche plus avec plusieurs hôtes. Il faut faire l'inventaire des URLs absolues (callbacks SSO, liens de partage, liens dans les mails, jeton realtime…) et les **dériver de l'hôte de la requête**.
- Un nouveau type demande une entrée DNS, une entrée dans `VIRTUAL_HOST` / `LETSENCRYPT_HOST` et une entrée dans `BUSINESS_HOSTS`.

## 10. Phases

Chaque phase est livrable seule et ne casse rien pour le dispensaire actuel.

| # | Phase | Contenu |
|---|---|---|
| 0 | Réflexion | Ce document. |
| 1 | Renommage interne | `Dispensary` → `Business` dans le code (Prisma `@@map`, identifiants, `lib/dispensary` → `lib/business`). **Aucun changement de comportement.** |
| 2 | Types d'entreprise | La colonne `type`, le registre `businessTypes`, les modules autorisés par type, les rôles par défaut par type. |
| 3 | Activité hebdo générique | Les compteurs clé/valeur, la migration des colonnes, la ressource `weekly_activity`. |
| 4 | Profils communs | `Person` + `BusinessPerson`, la migration des profils Discord. |
| 5 | Routage | Résolution par hôte, chemins sans préfixe, slugs réservés, redirections depuis `/d/`, page de choix, page d'accueil, switcher du Header. |
| 6 | Bascule des services | `scopeType: 'business'` dans inventory, bank, agenda, media (et documents si besoin), topics realtime. |
| 7 | General store | Le type `GENERAL_STORE` : thème bleu, logo, rôles, compteurs, module catalogue de prix, création depuis `/platform`. |
| 8 | Mise en prod et nettoyage | Déploiement multi-hôtes (`business`, `dispensaire`, `gs`), puis renommage final de l'app (`apps/dispensary` → `apps/business`, Docker, turbo, docs, `CLAUDE.md`) et fin des libellés « dispensaire » codés en dur. |

### Phase 1 : ce qui a été fait

- **Renommé :**
  - les modèles Prisma (`Business`, `BusinessMember`, `BusinessRolePermission`, `BusinessMemberPermission`, `BusinessDiscordProfile`, `BusinessWeeklyActivity*`) et les champs `businessId` / `businessName`, avec des `@map` / `@@map` vers les tables, colonnes et enums existants. `prisma migrate diff` est vide : il n'y a aucune migration ;
  - tous les identifiants TypeScript de l'app (`dispensarySlug` → `businessSlug`, `dispensaryId` → `businessId`, etc.) ;
  - les dossiers `lib/dispensary` → `lib/business`, `lib/dispensaryWeeklyActivity` → `lib/businessWeeklyActivity` et `lib/dispensaryDiscordProfile` → `lib/businessDiscordProfile` ;
  - les fichiers `_actions/dispensary*` et les composants `Dispensary*` ;
  - le paramètre de route `[dispensarySlug]` → `[businessSlug]` ;
  - les paramètres de `packages/realtime/src/topics.ts`.
- **Gardé tel quel**, pour les phases suivantes :
  - les URLs (`/d/…`, `/api/dispensary/…`, `/platform/dispensaries`, `/auth/no-dispensary-access`) ;
  - les en-têtes et paramètres des bots (`x-dispensary-id`, `?dispensaryId=`) ;
  - `scopeType: 'dispensary'` ;
  - la feature `weeklyDispensaryActivity` et la permission `weekly_dispensary_activity` ;
  - les noms d'événements des logs ;
  - les variables d'env (`DISPENSARY_*`) ;
  - les libellés de l'UI ;
  - le préfixe CSS `--disp-*` ;
  - le nom de l'app.
- Le nom `BusinessWeeklyActivity` est provisoire : la phase 3 refond l'activité hebdo (`weeklyActivity` est déjà pris par d'autres identifiants).

### Phase 2 : ce qui a été fait

- **Base de données :** `enum BusinessType { DISPENSARY }` et une colonne `type` sur `Business` (migration `add_business_type`). Le dispensaire existant prend `DISPENSARY`. `GENERAL_STORE` sera ajouté en phase 7.
- **Registre :** `lib/businessTypes` décrit chaque type (libellés, `modules`, `memberRoles`, `defaultRoleMatrix`) et fournit `isModuleAllowedForType`, `isMemberRoleAllowedForType` et `isResourceAllowedForType`.
- **Modules :** `AppSettingsDTO.businessType` est lu sur l'entreprise. `normalizeAppSettings` coupe les modules que le type ne propose pas, donc les gardes, la navigation, le jeton realtime et les bots en tiennent compte. Les réglages n'affichent que les modules proposés.
- **Rôles et permissions :**
  - le seed et la réinitialisation utilisent la matrice du type ;
  - les membres, les permissions et les accès aux coffres se limitent aux rôles du type, avec une vérification côté serveur ;
  - les écrans de permissions ne montrent que les ressources des modules proposés.
- Le dispensaire garde tous ses modules et tous ses rôles : rien ne change pour lui.

### Phase 3 : ce qui a été fait

- **Permission et feature renommées :** `weekly_dispensary_activity` devient `weekly_activity`, et la feature `weeklyDispensaryActivity` devient `weeklyActivity`. La colonne `featureWeeklyDispensaryActivityEnabled` reste, avec un `@map`. Les permissions et les logs déjà enregistrés ont été migrés.
- **Compteurs :** une colonne `counters` en JSON (clé → valeur, une clé absente vaut 0) remplace `patientsCount`, `sherifCount`, `infusionsCount` et `poppyMilkCount`. Le registre déclare les compteurs de chaque type (`weeklyCounters` : libellé, icône, ancien champ des bots, statistique de paie, signal d'horaires).
- **Réglages :** `AppSettings.weeklyActivityCounters` (clé → activé, une clé absente est activée) remplace les quatre drapeaux `weeklyActivity*Visible`. La caisse et la présence gardent leurs drapeaux.
- **Historique :** les actions `INCREMENT_/DECREMENT_COUNTER` ont une colonne `counterKey`. Les anciennes lignes ont été converties, et les instantanés stockent un objet `counters`. Les anciennes valeurs d'enum restent présentes, mais ne servent plus.
- **API des bots :** rien ne change pour les bots existants. Les lignes gardent `patientsCount` et les autres champs, en plus de `counters`. Le POST et le PATCH acceptent les anciens champs ou `counters`.
- **Paie et récap des horaires :** ils lisent les compteurs à travers le registre (`payrollStat`, `hoursSignal`).
- **Interface :** les boutons rapides, le tableau, les formulaires, la vue compacte, l'historique et les réglages sont générés depuis les compteurs du type.

### Phase 4 : ce qui a été fait

- **Données :** `dispensary_discord_profile` est découpé en deux tables :
  - `person`, une par ID Discord : nom du bot, nom fixé, n° de compte (unique sur toute la plateforme), lien SSO ;
  - `business_person`, le rattachement à une entreprise, avec le grade.

  La migration `shared_people` garde les identifiants des profils comme identifiants des rattachements.
- **Lectures :** elles restent limitées aux personnes connues de l'entreprise (`personInBusiness`). L'affichage ne change donc pas.
- **Écritures :**
  - le nom fixé et le n° de compte s'appliquent à la personne, dans toutes ses entreprises ;
  - le grade reste propre à chaque entreprise ;
  - ajouter dans Gestion › Personnes quelqu'un qui est déjà connu ailleurs le rattache, sans créer de doublon ;
  - le lien vers le compte SSO est mis à jour pour la personne, donc partout.
- **Code :** les lectures sont dans `lib/businessDiscordProfile/queries.ts` (sans import Prisma à l'exécution), les écritures dans `service.ts`.

### Phase 5 : ce qui a été fait

- **Chemins :** les pages d'une entreprise sont à `/<slug>/…` (dossier `app/(loggedIn)/[businessSlug]`) et `tenantRoutes` part de `/<slug>`.
  - Les anciens `/d/<slug>/…` redirigent en 308, tout comme les anciens chemins sans entreprise.
  - Les slugs réservés (`RESERVED_BUSINESS_SLUGS` : `api`, `auth`, `platform`, `settings`, `admin`, `partage`, `d`, `test` et les anciens chemins) sont refusés à la création et au renommage.
  - Le matcher du middleware couvre toutes les pages, sauf `/api`, `/_next`, `/partage` et les fichiers statiques.
  - Les routes internes `/api/d/<slug>/…` (lectures, jeton realtime) ne changent pas.
- **Hôtes :** `BUSINESS_TYPE_HOSTS` (`DISPENSARY=dispensaire.aerokusu.fr,…`) associe chaque type à son hôte (`lib/business/hosts.ts`).
  - Sur l'hôte d'un type, seules ses entreprises sont proposées.
  - Une entreprise ouverte sur l'hôte d'un autre type est redirigée en 308 vers le sien.
  - L'hôte principal, `NEXT_PUBLIC_APP_URL`, sert toutes les entreprises.
  - Sans cette variable, rien ne change.
- **Racine `/` :**
  - une seule entreprise accessible sur cet hôte : on y entre directement ;
  - plusieurs : page de choix groupée par type (`BusinessPicker`) ;
  - aucune : page d'accueil avec les types d'entreprises et « demandez l'accès à votre responsable ».
  - `/auth/no-dispensary-access` renvoie vers `/`.
- **Sélecteur :** dans le header et dans la page Compte, il est groupé par type. Il garde la même page et change d'hôte si besoin (`AccessibleBusiness.origin`).
- **SSO :**
  - le dispensaire accepte les hôtes de `BUSINESS_TYPE_HOSTS` comme retour de connexion, et la connexion revient sur l'hôte d'origine ;
  - auth accepte `business.localhost` et `gs.localhost` en dev, et une liste d'hôtes dans `DISPENSARY_VIRTUAL_HOST` (séparés par des virgules) en prod ;
- **Prod :** la configuration est décrite dans `docs/DOCKER.md` › « Plusieurs hôtes ». Elle utilise `DISPENSARY_VIRTUAL_HOST` en liste, `BUSINESS_TYPE_HOSTS` et `DISPENSARY_EXTRA_PUBLIC_URLS` pour les origines realtime. Le compose et `docker/.env.example` sont prêts.

### Phase 6 : ce qui a été fait

- **Code :** `serviceHost` du dispensaire passe à `scopeType: 'business'`. Les clients agenda, médias, inventaire et banque, les topics realtime (`agendas:business:<id>`, `media:business:<id>`) et les liens de partage le suivent.
- **Données :** une migration `business_scope_type` dans inventory (11 tables), bank (5), agenda (1) et media (3) passe `scopeType` de `'dispensary'` à `'business'`. Les lignes du refuge ne bougent pas, et documents n'a pas de type de scope.
- **Médias :** les clés S3 enregistrées gardent leur préfixe `dispensary/<id>/`, donc les fichiers restent lisibles. `purgeScope` efface aussi l'ancien préfixe.
- **Banque :** le bot `materialize-planned` utilise `business` quand `X-Scope-Type` est absent, ce qui couvre les anciens appels avec seulement `X-Dispensary-Id`.
- **Déploiement :** les services appliquent leur migration au démarrage (`prisma migrate deploy`). Il faut déployer les services et le dispensaire ensemble.

## 11. Questions encore ouvertes

- D'éventuels **autres modules propres** au general store.
- Faut-il un réglage « visible au catalogue » par objet pour le catalogue de prix ?
- La **matrice de permissions** exacte du rôle employé du general store.

## Fichiers de référence

- `apps/dispensary/prisma/schema.prisma`
- `apps/dispensary/src/middleware.ts`, `src/lib/dispensary/{context,slug,permissionsSeed,permissionsResolve}.ts`
- `apps/dispensary/src/lib/serverActionAuth.ts`, `src/lib/appSettingsShared.ts`, `src/lib/serviceHost.ts`
- `apps/dispensary/src/app/page.tsx`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/(loggedIn)/_components/Header/Header.tsx`
- `apps/dispensary/src/types/routes.ts` (`tenantRoutes`)
- `apps/dispensary/src/lib/dispensaryWeeklyActivityApiAuth.ts` (bots)
- `packages/auth-permissions/src/catalog.ts`, `packages/realtime/src/topics.ts`, `packages/host-kit/src/serviceHost.ts`, `packages/service-kit/src/scope.ts`
- `apps/auth/src/lib/{auth,constants,ssoHosts}.ts`
- `docker-compose.yml`, `docker/.env.example`, `docs/DOCKER.md`
