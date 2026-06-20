import { describe, expect, it } from 'vitest';
import {
  parseTemplateDocument,
  serializeTemplateDocument,
  serializeInput,
  escapeAttributeValue,
} from './document';

const roundTrip = (content: string) => {
  const { document } = parseTemplateDocument(content);
  return serializeTemplateDocument(document);
};

describe('parseTemplateDocument / serializeTemplateDocument round-trip', () => {
  it('preserves plain text', () => {
    expect(roundTrip('Hello world')).toBe('Hello world');
  });

  it('preserves variables in text', () => {
    const content = 'Bonjour ${name},\n${items}\nTotal: ${price}';
    expect(roundTrip(content)).toBe(content);
  });

  it('preserves text input', () => {
    const content =
      '{input:[type="text"][name="nom"][label="Nom"][placeholder="..."][required="true"]}';
    expect(roundTrip(content)).toBe(content);
  });

  it('preserves checkbox with checkedValue and escapes', () => {
    const content =
      '{input:[type="checkbox"][name="adr"][label="Adr"][checkedValue="- Ligne 1\\n- Ligne 2:"]}';
    expect(roundTrip(content)).toBe(content);
  });

  it('preserves dependsOn and layout', () => {
    const content =
      '{input:[type="text"][name="detail"][dependsOn="adr"][layout="below"][placeholder="Préciser..."]}';
    const { document } = parseTemplateDocument(content);
    const reserialized = serializeTemplateDocument(document);
    const { document: reparsed } = parseTemplateDocument(reserialized);
    expect(reparsed.segments).toEqual(document.segments);
  });

  it('preserves category', () => {
    const content = '{category:"Signes observés"}';
    expect(roundTrip(content)).toBe(content);
  });

  it('preserves conditional block', () => {
    const content =
      '{if:[var="description"][empty="Madame, Monsieur,"][filled="En ma qualité de ${description},"]}';
    expect(roundTrip(content)).toBe(content);
  });

  it('preserves equality conditional block', () => {
    const content =
      '{if:[var="gender"][eq="female"][then="Je soussignée"][else="Je soussigné"]}';
    expect(roundTrip(content)).toBe(content);
  });

  it('preserves standalone js block', () => {
    const content = 'A {js:(()=>"value")():endjs} B';
    expect(roundTrip(content)).toBe(content);
  });

  it('preserves js default inside input without splitting', () => {
    const content =
      '{input:[type="text"][name="n"][label="L"][default={js:(()=>"computed")():endjs}]}';
    expect(roundTrip(content)).toBe(content);
  });

  it('preserves composite template from renderer tests', () => {
    const content = [
      'Matériaux:',
      '{input:[type="checkbox"][name="adr"][label="Seringue d\'Adrénaline"][checkedValue="- Seringue d\'Adrénaline:"]}',
      '{input:[type="checkbox"][name="bandage"][label="Bandage"][checkedValue="- Bandage:"]}',
      '',
      '-- Signes --',
      '{category:"Signes observés"}',
      '{input:[type="checkbox"][name="hematomes"][label="Hématomes"][checkedValue="- Hématomes"]}',
      '{input:[type="text"][name="hematomes_detail"][dependsOn="hematomes"]}',
      '',
      '{if:[var="description"][empty="Madame, Monsieur,"][filled="En ma qualité de ${description},"]}',
      'Bonjour ${name}, voici votre commande :',
      '${items}',
      'Total : ${price}',
    ].join('\n');

    const { document } = parseTemplateDocument(content);
    const reserialized = serializeTemplateDocument(document);
    const { document: reparsed } = parseTemplateDocument(reserialized);
    expect(reparsed.segments).toEqual(document.segments);
  });

  it('preserves select with options', () => {
    const content =
      '{input:[type="select"][name="urgence"][label="Urgence"][options="Basse|Moyenne|Haute"]}';
    expect(roundTrip(content)).toBe(content);
  });

  it('preserves complex js default with array brackets inside input attribute', () => {
    const jsCode =
      "((function() { var mois = ['janvier', 'février', 'mars']; return '15 au 21 juin 1890'; })())";
    const content = `Semaine du {input:[type="text"][name="semaine-du"][label="Semaine concernée"][default={js:${jsCode}:endjs}]}`;
    const { document } = parseTemplateDocument(content);
    const inputSegment = document.segments.find((s) => s.kind === 'input');
    expect(inputSegment?.kind).toBe('input');
    if (inputSegment?.kind === 'input') {
      expect(inputSegment.input.defaultValue).toBe(`{js:${jsCode}:endjs}`);
    }
    expect(document.segments.filter((s) => s.kind === 'js')).toHaveLength(0);
    expect(roundTrip(content)).toBe(content);
  });
});

describe('serializeInput', () => {
  it('escapes newlines in attribute values', () => {
    const serialized = serializeInput({
      type: 'checkbox',
      name: 'x',
      label: 'X',
      checkedValue: '- Line 1\n- Line 2',
    });
    expect(serialized).toContain('checkedValue="- Line 1\\n- Line 2"');
  });
});

describe('escapeAttributeValue', () => {
  it('escapes backslashes and newlines', () => {
    expect(escapeAttributeValue('a\\nb')).toBe('a\\\\nb');
    expect(escapeAttributeValue('line1\nline2')).toBe('line1\\nline2');
  });
});
