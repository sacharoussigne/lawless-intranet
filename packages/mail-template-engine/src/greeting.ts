export function applyGreetingAdaptation(content: string, now: Date = new Date()): string {
  const isEvening = now.getHours() >= 18;

  if (isEvening) {
    let result = content.replace(/Bonjour/gi, (match) => {
      if (match === 'Bonjour') return 'Bonsoir';
      if (match === 'BONJOUR') return 'BONSOIR';
      return 'bonsoir';
    });
    result = result.replace(/journée/gi, (match) => {
      if (match === 'Journée') return 'Soirée';
      if (match === 'JOURNÉE') return 'SOIRÉE';
      if (match === 'JOURNEE') return 'SOIREE';
      return 'soirée';
    });
    return result;
  }

  let result = content.replace(/Bonsoir/gi, (match) => {
    if (match === 'Bonsoir') return 'Bonjour';
    if (match === 'BONSOIR') return 'BONJOUR';
    return 'bonjour';
  });
  result = result.replace(/soirée/gi, (match) => {
    if (match === 'Soirée') return 'Journée';
    if (match === 'SOIRÉE') return 'JOURNÉE';
    if (match === 'SOIREE') return 'JOURNEE';
    return 'journée';
  });
  return result;
}
