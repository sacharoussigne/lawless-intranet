/** French labels for history action enum (UI). */
export function formatBusinessHistoryAction(
  action: string,
  /** Label of the counter of INCREMENT_/DECREMENT_COUNTER. */
  counterLabel?: string | null,
): string {
  if (action === 'INCREMENT_COUNTER' || action === 'DECREMENT_COUNTER') {
    const verb = action === 'INCREMENT_COUNTER' ? 'Incrément' : 'Décrément';
    return counterLabel ? `${verb} ${counterLabel.toLowerCase()}` : `${verb} compteur`;
  }
  // Legacy per-counter actions (migrated to INCREMENT_/DECREMENT_COUNTER).
  const map: Record<string, string> = {
    CREATE: 'Création',
    DELETE: 'Suppression',
    UPDATE: 'Modification',
    INCREMENT_CHEST: 'Incrément caisses',
    DECREMENT_CHEST: 'Décrément caisses',
    UPDATE_CHEST_DAYS: 'Mise à jour caisses (jours)',
    UPDATE_PRESENCE_DAYS: 'Mise à jour présences (jours)',
    INCREMENT_SHERIFF: 'Incrément soins shérifs',
    DECREMENT_SHERIFF: 'Décrément soins shérifs',
    INCREMENT_PALEFRENIER: 'Modification compteur',
    DECREMENT_PALEFRENIER: 'Modification compteur',
    INCREMENT_PATIENTS: 'Incrément patients',
    DECREMENT_PATIENTS: 'Décrément patients',
    INCREMENT_INFUSIONS: 'Incrément infusions',
    DECREMENT_INFUSIONS: 'Décrément infusions',
    INCREMENT_POPPY_MILK: 'Incrément lait de pavot',
    DECREMENT_POPPY_MILK: 'Décrément lait de pavot',
  };
  return map[action] ?? action;
}
