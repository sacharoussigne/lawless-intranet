import type { TemplateInput, TemplateSegment } from '@lawless-intranet/mail-template-engine';

export const BUILTIN_VARIABLES = [
  'name',
  'items',
  'price',
  'username',
  'description',
  'gender',
] as const;

/** What each built-in variable holds when the letter is generated. */
export const BUILTIN_VARIABLE_DESCRIPTIONS: Record<(typeof BUILTIN_VARIABLES)[number], string> = {
  name: 'Commandes : nom du client (entreprise ou particulier)',
  items: 'Commandes : liste des articles avec leurs quantités',
  price: 'Commandes : prix total de la commande',
  username: 'Nom de l’auteur du courrier',
  description: 'Description (fonction) de l’auteur du courrier',
  gender: 'Genre de l’auteur : male ou female',
};

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
