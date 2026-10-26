/** Levels of the org chart, from the top; each groups the masculine and feminine grade. */
export const ORG_CHART_LEVELS = [
  { key: 'direction', label: 'Direction', roles: ['Directeur', 'Directrice'] },
  { key: 'codirection', label: 'Co-direction', roles: ['Co-Directeur', 'Co-Directrice'] },
  { key: 'doctors', label: 'Médecins', roles: ['Médecin'] },
  { key: 'nurses', label: 'Infirmiers', roles: ['Infirmier', 'Infirmière'] },
  { key: 'apprentices', label: 'Apprentis', roles: ['Apprenti', 'Apprentie'] },
] as const;

export type OrgChartLevel<T> = { key: string; label: string; people: T[] };

/** People by grade level (top first), empty levels left out; unknown grades go to « Sans grade ». */
export function groupStaffByGrade<T extends { displayName: string; role: string | null }>(
  people: T[],
): OrgChartLevel<T>[] {
  const levelOf = new Map<string, string>(
    ORG_CHART_LEVELS.flatMap((level) => level.roles.map((role) => [role, level.key] as const)),
  );
  const byLevel = new Map<string, T[]>();
  for (const person of people) {
    const key = levelOf.get(person.role?.trim() ?? '') ?? 'none';
    byLevel.set(key, [...(byLevel.get(key) ?? []), person]);
  }
  return [...ORG_CHART_LEVELS, { key: 'none', label: 'Sans grade' }]
    .map((level) => ({
      key: level.key,
      label: level.label,
      people: (byLevel.get(level.key) ?? []).sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr')),
    }))
    .filter((level) => level.people.length > 0);
}
