export type EvalResult = number | '';

const isAllowedExpression = (expression: string) => /^[\d+\-*/().]+$/.test(expression);

const safeEval = (expression: string): number | null => {
  const cleaned = expression.replace(/\s/g, '');
  if (!cleaned) return null;
  if (!isAllowedExpression(cleaned)) return null;

  try {
    const result = new Function('return ' + cleaned)();
    if (typeof result !== 'number') return null;
    if (!Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
};

export const evaluateIntegerExpression = (expression: string): EvalResult => {
  const result = safeEval(expression);
  if (result === null) return '';
  return Math.round(result);
};

export const evaluateDecimalExpression = (expression: string): EvalResult => {
  const result = safeEval(expression);
  if (result === null) return '';
  return result;
};

export const normalizeQuantity = (quantity: number | null | undefined): number => {
  if (quantity == null) return 0;
  return quantity;
};
