export type {
  FormSection,
  RenderContext,
  RenderOptions,
  TemplateInput,
  TemplateParameter,
} from './types';

export {
  extractFormSections,
  extractInputs,
  extractJsCode,
  parseTemplateParameters,
} from './parser';

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
