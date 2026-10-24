# API HTTP — Rapport de paie (bot Discord)

Route utilisée par la commande `/rapport` du bot Discord : elle crée le **rapport de paie « Employés »** d’une semaine, rempli avec l’**activité hebdomadaire**, et renvoie le lien de sa page dans l’intranet.

Même base d’URL et même authentification que l’[API de l’activité hebdomadaire](./api-dispensary-weekly-activity-bot.md#authentification) (`Authorization: Bearer`, `X-Dispensary-Id`).

## `POST /api/dispensary/bot/payroll-report`

- **Accès** : le bot ne propose la commande qu’au rôle Direction du serveur (réglé dans `/config`). L’intranet ne vérifie pas de permission par utilisateur : le secret du bot suffit, comme pour le récap d’équipe.
- Il faut l’**activité hebdomadaire** et la **paie** activées pour l’entreprise, sinon **403**.
- La semaine est celle (lundi → dimanche, Europe/Paris) qui contient `date`, aujourd’hui par défaut.
- Le rapport est de type **« Employés »**, avec les prix par défaut (caisse 6,5 $, vente 7,5 $, patient 0,3 $, objet offert 0,4 $) ; ils se modifient ensuite sur la page du rapport.
- Il n’y a qu’un rapport par semaine et par type : si celui de la semaine existe déjà, la route renvoie **ce rapport** (`alreadyExists: true`) au lieu d’en créer un second.
- Auteur du rapport : le compte intranet lié au Discord de l’appelant, sinon `discord:<id>` (affiché « Utilisateur »).

**En-têtes**

| En-tête | Obligatoire | Description |
|---------|-------------|-------------|
| `Authorization` | Oui | `Bearer <DISPENSARY_BOT_API_SECRET>` |
| `X-Dispensary-Id` | Oui | UUID de l’entreprise |
| `X-Discord-User-Id` | Oui | ID Discord de la personne qui lance la commande |

**Corps** (JSON, facultatif)

| Champ | Type | Description |
|-------|------|-------------|
| `date` | `YYYY-MM-DD` | Un jour de la semaine voulue (calendrier Europe/Paris). Par défaut : aujourd’hui. |

**Réponse 200 — `data`**

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | ID du rapport |
| `url` | string | Lien absolu vers la page du rapport (hôte du type d’entreprise via `BUSINESS_TYPE_HOSTS`, sinon `NEXT_PUBLIC_APP_URL`) |
| `reportType` | string | `"Employés"` |
| `weekStart`, `weekEnd` | ISO 8601 | Lundi 00:00 → dimanche 23:59:59 (Europe/Paris) |
| `alreadyExists` | boolean | `true` si le rapport existait déjà (rien n’a été créé) |

```json
{
  "status": 200,
  "data": {
    "id": "6f0c…",
    "url": "https://dispensaire.example.com/saint-denis/employee/payroll/6f0c…",
    "reportType": "Employés",
    "weekStart": "2026-10-18T22:00:00.000Z",
    "weekEnd": "2026-10-25T22:59:59.999Z",
    "alreadyExists": false
  }
}
```

| HTTP | Cas |
|------|-----|
| **200** | Rapport créé, ou rapport existant de la semaine |
| **400** | `X-Dispensary-Id` ou `X-Discord-User-Id` absent, corps JSON invalide |
| **401** | Secret invalide |
| **403** | Activité hebdomadaire ou paie désactivée |
| **404** | Entreprise inconnue |
| **422** | `date` invalide (format ou jour inexistant) |
| **500** | Échec de la création (le rapport est enregistré avec son message d’erreur) |

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $DISPENSARY_BOT_API_SECRET" \
  -H "X-Dispensary-Id: 00000000-0000-4000-8000-000000000001" \
  -H "X-Discord-User-Id: 284726189304512512" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-10-14"}' \
  http://localhost:3000/api/dispensary/bot/payroll-report
```

## Fichiers de référence (code)

- Route : `src/app/api/dispensary/bot/payroll-report/route.ts`
- Création (partagée avec le formulaire de l’intranet) : `src/lib/payroll/createReport.ts`
- Lien public : `publicBusinessOrigin` dans `src/lib/business/hosts.ts`, chemin via `tenantRoutes(slug).employee.payrollDetail(id)`
