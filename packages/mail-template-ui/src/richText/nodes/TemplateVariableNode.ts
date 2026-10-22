import { Node, mergeAttributes } from '@tiptap/core';
import { VARIABLE_NODE } from '../convert';
import classes from '../richText.module.scss';

/** `${name}` shown as a pill. */
export const TemplateVariableNode = Node.create({
  name: VARIABLE_NODE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-template-variable') ?? '',
        renderHTML: (attributes) => ({ 'data-template-variable': attributes.name }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-template-variable]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: classes.variablePill }), node.attrs.name];
  },

  renderText({ node }) {
    return `\${${node.attrs.name}}`;
  },
});
