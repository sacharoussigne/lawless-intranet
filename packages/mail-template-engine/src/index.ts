export type {
  FormSection,
  ParseWarning,
  RenderContext,
  RenderOptions,
  TemplateDocument,
  TemplateInput,
  TemplateParameter,
  TemplateSegment,
  UserGender,
} from './types';
export type { TemplateDocumentEntry } from './document';

export {
  extractFormSections,
  extractInputs,
  extractJsCode,
  parseInputAttributes,
  parseTemplateParameters,
} from './parser';

export {
  escapeAttributeValue,
  parseSelectOptions,
  parseTemplateDocument,
  parseTemplateDocumentEntries,
  serializeConditional,
  serializeInput,
  serializeSegment,
  serializeTemplateDocument,
} from './document';

export {
  executeJsCode,
  getReplacementSpan,
  renderTemplate,
  resolveInputReplacement,
  resolveJsValue,
} from './renderer';

export { applyGreetingAdaptation } from './greeting';
export {
  buildRenderContext,
  buildUserTemplateRenderContext,
  DEFAULT_TEMPLATE_USERNAME,
  resolveRenderVariables,
} from './context';
export { extractVariables, resolveVariable, substituteVariables } from './variables';
export { processConditionalBlocks } from './conditions';
