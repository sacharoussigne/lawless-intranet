import type { TemplateInput, TemplateSegment } from '@lawless-intranet/mail-template-engine';

export const BUILTIN_VARIABLES = [
  'name',
  'items',
  'price',
  'username',
  'description',
  'gender',
] as const;

export function createDefaultSegment(kind: TemplateSegment['kind']): TemplateSegment {
  switch (kind) {
    case 'text':
      return { kind: 'text', value: '' };
    case 'input':
      return {
        kind: 'input',
        input: {
          type: 'text',
          name: `field_${Date.now()}`,
          label: 'Nouveau champ',
        },
      };
    case 'category':
      return { kind: 'category', title: 'Nouvelle section' };
    case 'conditional':
      return {
        kind: 'conditional',
        var: 'description',
        empty: 'Madame, Monsieur,',
        filled: 'En ma qualité de ${description},',
      };
    case 'js':
      return { kind: 'js', code: '(() => "")()' };
  }
}

export function segmentLabel(segment: TemplateSegment): string {
  switch (segment.kind) {
    case 'text':
      return 'Texte';
    case 'input':
      return `Input (${segment.input.type})`;
    case 'category':
      return 'Catégorie';
    case 'conditional':
      return 'Conditionnel';
    case 'js':
      return 'JavaScript';
  }
}

export function updateSegmentAtIndex(
  segments: TemplateSegment[],
  index: number,
  segment: TemplateSegment,
): TemplateSegment[] {
  return segments.map((current, currentIndex) =>
    currentIndex === index ? segment : current,
  );
}

export function removeSegmentAtIndex(
  segments: TemplateSegment[],
  index: number,
): TemplateSegment[] {
  return segments.filter((_, currentIndex) => currentIndex !== index);
}

export function moveSegment(
  segments: TemplateSegment[],
  index: number,
  direction: 'up' | 'down',
): TemplateSegment[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= segments.length) {
    return segments;
  }

  const next = [...segments];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export function insertSegmentAt(
  segments: TemplateSegment[],
  index: number,
  segment: TemplateSegment,
): TemplateSegment[] {
  const next = [...segments];
  next.splice(index, 0, segment);
  return next;
}
