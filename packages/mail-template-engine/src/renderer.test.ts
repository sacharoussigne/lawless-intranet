import { describe, expect, it } from 'vitest';
import { renderTemplate, resolveInputReplacement } from './renderer';
import type { RenderContext, RenderOptions, TemplateInput } from './types';

const withoutGreeting: RenderOptions = { applyGreetingAdaptation: false };

function render(template: string, context: RenderContext, options?: RenderOptions) {
  return renderTemplate(template, context, options ?? withoutGreeting);
}

describe('renderTemplate with default={js}', () => {
  it('replaces input using resolved JS default when context is empty', () => {
    const template =
      '{input:[type="text"][name="n"][label="L"][default={js:(()=>"computed")():endjs}]}';
    const rendered = render(template, { inputs: {} });
    expect(rendered).toBe('computed');
  });

  it('uses form value over default', () => {
    const template =
      '{input:[type="text"][name="n"][label="L"][default={js:(()=>"computed")():endjs}]}';
    const rendered = render(template, { inputs: { n: 'edited' } });
    expect(rendered).toBe('edited');
  });
});

describe('renderTemplate with checkbox', () => {
  const checkboxTemplate =
    'Matériaux:\n{input:[type="checkbox"][name="adr"][label="Seringue d\'Adrénaline"][checkedValue="- Seringue d\'Adrénaline:"]}\n{input:[type="checkbox"][name="bandage"][label="Bandage"][checkedValue="- Bandage:"]}';

  it('inserts checkedValue when checkbox is checked', () => {
    const rendered = render(checkboxTemplate, {
      inputs: { adr: 'true', bandage: 'false' },
    });
    expect(rendered).toBe("Matériaux:\n- Seringue d'Adrénaline:");
  });

  it('inserts nothing when checkbox is unchecked', () => {
    const rendered = render(checkboxTemplate, {
      inputs: { adr: 'false', bandage: 'false' },
    });
    expect(rendered).toBe('Matériaux:');
  });

  it('removes blank lines between sections when checkboxes are unchecked', () => {
    const template =
      '-- Localisation --\n{input:[type="checkbox"][name="a"][label="A"][checkedValue="A"]}\n{input:[type="checkbox"][name="b"][label="B"][checkedValue="B"]}\n\n-- Observation --\nefkmefkmef';
    const rendered = render(template, {
      inputs: { a: 'false', b: 'false' },
    });
    expect(rendered).toBe(
      '-- Localisation --\n\n-- Observation --\nefkmefkmef'
    );
  });

  it('returns empty when checkedValue is missing', () => {
    const input: TemplateInput = {
      type: 'checkbox',
      name: 'x',
      label: 'Bandage',
    };
    const context = { inputs: {} };
    expect(
      resolveInputReplacement(input, 'true', context, [input])
    ).toBe('');
    expect(
      resolveInputReplacement(input, 'false', context, [input])
    ).toBe('');
  });

  it('returns empty when checkedValue is empty', () => {
    const input: TemplateInput = {
      type: 'checkbox',
      name: 'x',
      label: 'Bandage',
      checkedValue: '',
    };
    const context = { inputs: {} };
    expect(
      resolveInputReplacement(input, 'true', context, [input])
    ).toBe('');
  });

  it('returns only dependent value when checkedValue is missing', () => {
    const checkbox: TemplateInput = {
      type: 'checkbox',
      name: 'x',
      label: 'Bandage',
    };
    const detail: TemplateInput = {
      type: 'text',
      name: 'x_detail',
      label: 'Détail',
      dependsOn: 'x',
    };
    const context = { inputs: { x_detail: 'some detail' } };
    expect(
      resolveInputReplacement(checkbox, 'true', context, [checkbox, detail])
    ).toBe('some detail');
  });
});

describe('renderTemplate with dependsOn', () => {
  const template =
    '{input:[type="checkbox"][name="hematomes"][label="Hématomes"][checkedValue="- Hématomes"]}{input:[type="text"][name="hematomes_detail"][dependsOn="hematomes"]}';

  it('appends dependent value when checkbox is checked', () => {
    const rendered = render(template, {
      inputs: { hematomes: 'true', hematomes_detail: 'au bras gauche' },
    });
    expect(rendered).toBe('- Hématomes au bras gauche');
  });

  it('returns checkedValue only when detail is empty', () => {
    const rendered = render(template, {
      inputs: { hematomes: 'true', hematomes_detail: '' },
    });
    expect(rendered).toBe('- Hématomes');
  });

  it('returns empty when checkbox is unchecked', () => {
    const rendered = render(template, {
      inputs: { hematomes: 'false', hematomes_detail: 'au bras gauche' },
    });
    expect(rendered).toBe('');
  });

  it('does not render dependent input at its own position', () => {
    const detailInput: TemplateInput = {
      type: 'text',
      name: 'hematomes_detail',
      label: 'Détail',
      dependsOn: 'hematomes',
    };
    const context = { inputs: { hematomes_detail: 'visible only in parent' } };
    expect(
      resolveInputReplacement(detailInput, 'visible only in parent', context, [
        detailInput,
      ])
    ).toBe('');
  });
});

describe('renderTemplate with category', () => {
  it('removes category tags from rendered output', () => {
    const template =
      '-- Signes --\n{category:"Signes observés"}\n{input:[type="checkbox"][name="hematomes"][label="Hématomes"][checkedValue="- Hématomes"]}\n\nFin';
    const rendered = render(template, {
      inputs: { hematomes: 'true' },
    });
    expect(rendered).toBe('-- Signes --\n- Hématomes\n\nFin');
  });
});

describe('renderTemplate with empty inputs', () => {
  it('removes blank lines when text input on its own line is empty', () => {
    const template =
      '-- Localisation --\n{input:[type="text"][name="loc"][label="Localisation"]}\n\n-- Observation --\n{input:[type="text"][name="obs"][label="Observation"]}';
    const rendered = render(template, { inputs: {} });
    expect(rendered).toBe('-- Localisation --\n\n-- Observation --');
  });

  it('removes blank lines when textarea on its own line is empty', () => {
    const template =
      '-- Soins effectués --\n{input:[type="textarea"][name="soins"][label="Soins"]}\n\nFin';
    const rendered = render(template, { inputs: {} });
    expect(rendered).toBe('-- Soins effectués --\n\nFin');
  });

  it('keeps inline label when input on same line is empty', () => {
    const template =
      'Identité : {input:[type="text"][name="nom"][label="Nom"]} {input:[type="text"][name="prenom"][label="Prénom"]}';
    const rendered = render(template, { inputs: {} });
    expect(rendered).toBe('Identité :  ');
  });

  it('inserts value when input is filled', () => {
    const template =
      '-- Localisation --\n{input:[type="textarea"][name="loc"][label="Localisation"]}\n\n-- Observation --';
    const rendered = render(template, { inputs: { loc: 'Cuisse droite' } });
    expect(rendered).toBe('-- Localisation --\nCuisse droite\n\n-- Observation --');
  });
});

describe('renderTemplate with variables', () => {
  it('substitutes ${name} and ${items} after DSL rendering', () => {
    const template = 'Bonjour ${name},\n${items}';
    const rendered = render(template, {
      inputs: {},
      variables: {
        name: 'Jean Dupont',
        items: '- Bandage (x2)',
      },
    });
    expect(rendered).toBe('Bonjour Jean Dupont,\n- Bandage (x2)');
  });

  it('leaves unknown variables unchanged', () => {
    const template = 'Hello ${unknown}';
    const rendered = render(template, {
      inputs: {},
      variables: { name: 'Jean' },
    });
    expect(rendered).toBe('Hello ${unknown}');
  });

  it('renders mixed DSL and variables', () => {
    const template =
      '{input:[type="text"][name="note"][label="Note"]} — signé ${username}';
    const rendered = render(template, {
      inputs: { note: 'Urgent' },
      variables: { username: 'Dr. Martin' },
    });
    expect(rendered).toBe('Urgent — signé Dr. Martin');
  });

  it('substitutes ${username} from context.username', () => {
    const rendered = render(
      'Signé ${USERNAME}',
      { inputs: {}, username: 'Dr. Martin' },
    );
    expect(rendered).toBe('Signé Dr. Martin');
  });

  it('substitutes ${description} from context.userDescription', () => {
    const rendered = render(
      'Grade: ${description}',
      { inputs: {}, userDescription: 'Co-directrice' },
    );
    expect(rendered).toBe('Grade: Co-directrice');
  });

  it('applies conditional blocks before variable substitution', () => {
    const rendered = render(
      '{if:[var="description"][empty="Madame, Monsieur,"][filled="En ma qualité de ${description},"]}',
      { inputs: {}, userDescription: 'Directeur' },
    );
    expect(rendered).toBe('En ma qualité de Directeur,');
  });
});

describe('renderTemplate with greeting adaptation', () => {
  it('applies greeting adaptation by default', () => {
    const template = 'Bonjour ${name}, bonne journée';
    const evening = new Date('2026-06-18T20:00:00');
    const rendered = renderTemplate(
      template,
      { inputs: {}, variables: { name: 'Jean' } },
      { now: evening },
    );
    expect(rendered).toBe('Bonsoir Jean, bonne soirée');
  });

  it('replaces Bonjour with Bonsoir in the evening', () => {
    const template = 'Bonjour ${name}, bonne journée';
    const evening = new Date('2026-06-18T20:00:00');
    const rendered = renderTemplate(
      template,
      { inputs: {}, variables: { name: 'Jean' } },
      { applyGreetingAdaptation: true, now: evening }
    );
    expect(rendered).toBe('Bonsoir Jean, bonne soirée');
  });

  it('replaces Bonsoir with Bonjour in the morning', () => {
    const template = 'Bonsoir ${name}, bonne soirée';
    const morning = new Date('2026-06-18T10:00:00');
    const rendered = renderTemplate(
      template,
      { inputs: {}, variables: { name: 'Jean' } },
      { applyGreetingAdaptation: true, now: morning }
    );
    expect(rendered).toBe('Bonjour Jean, bonne journée');
  });
});
