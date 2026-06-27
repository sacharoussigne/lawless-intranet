# Cabinet — formulaires dynamiques et Markdown

Guide pour l'équipe et les propriétaires de cabinet : types de champs, configuration des schémas et syntaxe Markdown.

## Vue d'ensemble

Le module **Cabinet** permet de gérer des dossiers médicaux RP au sein d'un dispensaire.

### Hiérarchie des données

```
Cabinet
 └── Patient
      └── Prise en charge (épisode de soins)
           └── Consultation
```

### Routes utiles

| Route | Description |
|-------|-------------|
| `/d/{slug}/cabinet` | Liste des patients du cabinet sélectionné |
| `/d/{slug}/cabinet/forms` | Configuration des formulaires (OWNER) |
| `/d/{slug}/cabinet` (bouton Affichage) | Couleurs des libellés par type de champ (OWNER) |
| `/d/{slug}/cabinet/templates` | Modèles de documents de consultation |
| `/d/{slug}/cabinet/patients/{id}` | Fiche patient |
| `/d/{slug}/cabinet/patients/{id}/episodes/{id}` | Prise en charge |
| `/d/{slug}/cabinet/patients/.../consultations/{id}` | Consultation |

### Champs système vs personnalisés

- **Champs système** : colonnes fixes en base (prénom, motif, date de consultation, etc.). Définis par l'application, non modifiables dans le schéma.
- **Champs personnalisés** : définis par cabinet dans le schéma JSON (`Cabinet.formSchemas`), valeurs stockées dans `customValues`.

Chaque cabinet peut avoir son propre schéma pour trois entités :

1. **Fiche patient**
2. **Prise en charge**
3. **Consultation**

---

## Champs système (pas de Markdown)

Ces champs ne passent pas par le moteur Markdown.

### Fiche patient

| Champ | Type | Obligatoire |
|-------|------|-------------|
| Prénom | Texte court | Oui |
| Nom | Texte court | Oui |
| Date de naissance | Date (calendrier RP) | Non |
| Personne à contacter en cas d'urgence | Texte court | Non |

### Prise en charge

| Champ | Type | Obligatoire |
|-------|------|-------------|
| Motif | Texte court | Oui |
| Date de début | Date (calendrier RP) | Oui |

### Consultation

| Champ | Type | Obligatoire |
|-------|------|-------------|
| Date | Date (calendrier RP) | Oui |

---

## Types de champs personnalisés

| Type | Libellé UI | Saisie | Affichage en lecture | Options |
|------|------------|--------|----------------------|---------|
| `text` | Texte | Champ une ligne | **Markdown** | placeholder, obligatoire, modifiable, valeur par défaut |
| `textarea` | Zone de texte | Zone multi-lignes | **Markdown** | idem |
| `date` | Date | Sélecteur de date RP | Date formatée | idem |
| `select` | Liste déroulante | Liste simple ou multiple | Libellés des options | options, multiple, branches conditionnelles |

### Options communes

| Option | Description |
|--------|-------------|
| **Obligatoire** | Le champ doit être renseigné à l'enregistrement |
| **Placeholder** | Texte d'aide affiché dans le champ vide |
| **Valeur par défaut** | Valeur pré-remplie à la création |
| **Modifiable** | Si désactivé avec une valeur par défaut, le champ reste en lecture seule même en mode édition |
| **Ordre** | Les champs sont triés par ordre défini dans le schéma |

Les champs personnalisés sont regroupés en **catégories** (sections). Les catégories système existent déjà ; des catégories supplémentaires peuvent être ajoutées par un propriétaire de cabinet.

---

## Liste déroulante avancée

### Sélection simple

Une seule option choisie. La valeur stockée est l'identifiant interne de l'option.

### Sélection multiple

Plusieurs options possibles. La valeur est un tableau JSON d'identifiants d'options.

### Branches conditionnelles

Pour une liste déroulante, chaque option peut déclencher l'affichage de **sous-champs** supplémentaires lorsque cette option est sélectionnée.

**Exemple :**

- Champ : `Type de blessure` (liste)
  - Option `Plaie` → sous-champ `Localisation` (texte)
  - Option `Fracture` → sous-champ `Os concerné` (texte)

Les sous-champs suivent les mêmes règles que les champs racine (y compris le Markdown pour `text` / `textarea`).

---

## Markdown

### Périmètre

Le Markdown est interprété **uniquement** à la lecture pour les champs personnalisés de type **`text`** et **`textarea`**.

- En **édition** : saisie en texte brut (syntaxe Markdown visible).
- En **lecture** : rendu formaté.
- Les champs système, les dates, les listes et les documents de consultation ne sont pas concernés.

### Syntaxe supportée (GFM)

GitHub Flavored Markdown via `remark-gfm`. Exemples copiables :

#### Emphase

```markdown
**gras**
*italique*
~~barré~~
```

#### Titres

```markdown
# Titre principal
## Sous-titre
### Section
```

#### Listes

```markdown
- élément un
- élément deux

1. première étape
2. deuxième étape
```

Pour une **sous-liste à puces** sous un item numéroté, indenter les puces d’au moins **3 espaces** (sinon elles seront au même niveau que la liste numérotée) :

```markdown
1. Exercice principal
   - détail un
   - détail deux
2. Autre exercice
```

#### Liens

```markdown
[Texte du lien](https://exemple.com)
```

#### Citations

```markdown
> Note clinique importante.
```

#### Code

```markdown
Utiliser `dose` en inline.

```
bloc de code
plusieurs lignes
```
```

#### Tableaux

```markdown
| Symptôme | Intensité |
|----------|-----------|
| Fièvre   | Modérée   |
| Toux     | Légère    |
```

#### Séparateur

```markdown
---
```

### Exemple complet

**Source saisie :**

```markdown
## Observations

Patient présente une **douleur modérée** à l'épaule droite.

- Repos recommandé
- Suivi dans *48 h*

>Allergie connue : aucune signalée.

[Dossier externe](https://exemple.com/dossier)
```

**Rendu attendu en lecture :** titres, listes, gras, italique, citation et lien cliquable (style sauge du thème dispensaire).

### Limites et sécurité

- Le HTML arbitraire est **filtré** (`rehype-sanitize`) : pas de scripts ni de balises dangereuses.
- Le texte existant sans syntaxe Markdown s'affiche normalement (traité comme un paragraphe).
- Pas d'aperçu Markdown en direct pendant l'édition : seule la lecture interprète le formatage.

---

## Configuration des formulaires

**Accès requis :** niveau `OWNER` sur le cabinet (ou administrateur du dispensaire).

1. Aller sur `/d/{slug}/cabinet/forms`
2. Choisir l'onglet : **Fiche patient**, **Prise en charge** ou **Consultation**
3. Ajouter ou modifier des catégories et des champs
4. Pour chaque champ : choisir le type, le libellé, les options
5. Enregistrer le schéma

Les champs système apparaissent en aperçu fixe et ne peuvent pas être supprimés.

---

## Configuration de l'affichage

**Accès requis :** niveau `OWNER` sur le cabinet (ou administrateur du dispensaire).

Depuis la page principale du cabinet (`/d/{slug}/cabinet`), le bouton **Affichage** ouvre une modal permettant de définir une couleur de libellé par type de champ :

- Texte court, Zone de texte, Date, Liste déroulante, Champs système

Laissez un champ vide pour revenir à la couleur par défaut (encre atténuée). Les couleurs s'appliquent aux libellés en lecture seule et en édition, pas au contenu Markdown.

Un aperçu live montre le rendu label + contenu formaté avant enregistrement.

### Surcharge par champ

Dans `/d/{slug}/cabinet/forms`, développez un champ personnalisé : le réglage **Couleur du libellé** surcharge la couleur définie par type (modal Affichage) pour ce champ uniquement. Laissez vide pour hériter du type ou du défaut.

---

## Niveaux d'accès cabinet

| Niveau | Consultation | Saisie / édition | Configuration schémas |
|--------|--------------|------------------|------------------------|
| `READ` | Oui | Non | Non |
| `WRITE` | Oui | Oui (patients, prises en charge, consultations) | Non |
| `OWNER` | Oui | Oui | Oui (`/cabinet/forms`, templates) |

---

## Références code

| Fichier | Rôle |
|---------|------|
| [`src/lib/cabinet/formSchema/types.ts`](../src/lib/cabinet/formSchema/types.ts) | Types `FormField`, `FormCategory`, schémas |
| [`src/lib/cabinet/formSchema/fieldTypes.ts`](../src/lib/cabinet/formSchema/fieldTypes.ts) | Libellés des types de champs |
| [`src/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFieldInput.tsx`](../src/app/(loggedIn)/d/[dispensarySlug]/cabinet/components/DynamicFieldInput.tsx) | Rendu et saisie des champs |
| [`src/app/_components/MarkdownContent/MarkdownContent.tsx`](../src/app/_components/MarkdownContent/MarkdownContent.tsx) | Composant de rendu Markdown |
