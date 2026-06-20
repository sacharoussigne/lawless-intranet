export type {
  FormSection,
  ParseWarning,
  RenderContext,
  RenderOptions,
  TemplateDocument,
  TemplateInput,
  TemplateParameter,
  TemplateSegment,
} from './types';

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
  DEFAULT_TEMPLATE_USERNAME,
  resolveRenderVariables,
} from './context';
export { extractVariables, resolveVariable, substituteVariables } from './variables';
export { processConditionalBlocks } from './conditions';
