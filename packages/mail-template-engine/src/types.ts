export interface TemplateInput {
  type: string;
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  checkedValue?: string;
  dependsOn?: string;
  layout?: 'inline' | 'below';
}

export interface FormSection {
  title?: string;
  inputs: TemplateInput[];
}

export interface TemplateParameter {
  type: 'js' | 'input' | 'category';
  raw: string;
  startIndex: number;
  endIndex: number;
  jsCode?: string;
  input?: TemplateInput;
  categoryTitle?: string;
}

export interface RenderContext {
  inputs: Record<string, string>;
  /** Resolved automatically into `${username}` when present. */
  username?: string;
  variables?: Record<string, string>;
}

export interface RenderOptions {
  /** Enabled by default. Pass `false` to keep literal Bonjour/Bonsoir text. */
  applyGreetingAdaptation?: boolean;
  now?: Date;
}
