export function customValidationToActionError(
  fieldErrors: { fieldId: string; message: string }[],
) {
  return {
    status: 422 as const,
    error: fieldErrors.map((e) => ({ field: e.fieldId, message: e.message })),
  };
}
