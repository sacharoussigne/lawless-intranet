import { describe, expect, it } from 'vitest';
import {
  TOKEN_NODE,
  VARIABLE_NODE,
  collectInputs,
  editorDocToTemplate,
  templateToEditorDoc,
} from './convert';

const roundTrip = (content: string) => editorDocToTemplate(templateToEditorDoc(content));

describe('template ⇄ editor document', () => {
  it.each([
    ['empty', ''],
    ['plain text', 'Bonjour,'],
    ['blank lines and trailing newline', 'Bonjour,\n\n\nCordialement,\n'],
    ['variables', 'Je suis ${username}, ${description}.'],
    ['unknown variable syntax stays text', 'Prix : ${ price } et $ {x}'],
    [
      'tokens at line start and end',
      '{if:[var="gender"][eq="female"][then="Je soussignée"][else="Je soussigné"]} ${username}\nObjet : {input:[type="text"][name="objet"][label="Objet"]}',
    ],
    ['adjacent tokens', '{category:"Infos"}{input:[type="text"][name="a"]}{input:[type="number"][name="b"]}'],
    [
      'variable inside a condition',
      '{if:[var="description"][empty="Madame, Monsieur,"][filled="En ma qualité de ${description},"]}\nSuite',
    ],
    ['js default value', '{input:[type="text"][name="date"][default={js:new Date().getFullYear():endjs}]}'],
    ['js block', 'Total : {js:(() => 2 + 2)():endjs} €'],
    ['non-normalized attributes kept verbatim', '{input:[name=objet][type=text][label=Objet]}'],
  ])('keeps %s unchanged', (_label, content) => {
    expect(roundTrip(content)).toBe(content);
  });

  it('turns variables and tokens into pills', () => {
    const doc = templateToEditorDoc('A ${username} {category:"Titre"}\nB');
    expect(doc.content).toHaveLength(2);
    const [first] = doc.content ?? [];
    expect(first.content?.map((node) => node.type)).toEqual([
      'text',
      VARIABLE_NODE,
      'text',
      TOKEN_NODE,
    ]);
  });

  it('serializes an edited pill from its segment', () => {
    const doc = templateToEditorDoc('{category:"Ancien"}');
    const token = doc.content?.[0].content?.[0];
    if (!token?.attrs) throw new Error('missing token');
    token.attrs = { segment: { kind: 'category', title: 'Nouveau' }, raw: null };
    expect(editorDocToTemplate(doc)).toBe('{category:"Nouveau"}');
  });

  it('lists the input names', () => {
    const doc = templateToEditorDoc(
      '{input:[type="text"][name="objet"]} {input:[type="checkbox"][name="urgent"]}',
    );
    expect(collectInputs(doc).map((input) => input.name)).toEqual(['objet', 'urgent']);
  });
});
