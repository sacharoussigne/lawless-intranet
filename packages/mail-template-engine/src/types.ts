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
  /** Pipe- or comma-separated options for type="select". */
  options?: string;
}

export type TemplateSegment =
  | { kind: 'text'; value: string }
  | { kind: 'input'; input: TemplateInput }
  | { kind: 'category'; title: string }
  | { kind: 'conditional'; var: string; empty: string; filled: string }
  | { kind: 'js'; code: string };

export interface TemplateDocument {
  segments: TemplateSegment[];
}

export interface ParseWarning {
  message: string;
  startIndex?: number;
  endIndex?: number;
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
  /** Resolved automatically into `${description}` when present. */
  userDescription?: string;
  variables?: Record<string, string>;
}

export interface RenderOptions {
  /** Enabled by default. Pass `false` to keep literal Bonjour/Bonsoir text. */
  applyGreetingAdaptation?: boolean;
  now?: Date;
  /** When true, {input:…} placeholders are removed instead of rendered. */
  skipInputs?: boolean;
}
