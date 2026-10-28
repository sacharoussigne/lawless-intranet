/**
 * Business fields and forms: keep password managers (Dashlane, LastPass, 1Password,
 * Bitwarden) from offering autofill. Dashlane ignores `autocomplete="off"` and only
 * honours `data-form-type`; it also reads the whole `<form>`, labels included, so
 * spread these on every `<form>` too. Never used on sign-in or own-password fields.
 */
export const noAutofillProps: Record<string, string> = {
  autoComplete: 'off',
  'data-form-type': 'other',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
};
