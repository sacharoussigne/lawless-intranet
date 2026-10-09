/** Attribute set on `<html>` during a theme switch: scopes the reveal CSS below. */
export const THEME_TRANSITION_ATTRIBUTE = 'data-theme-transition';

/**
 * Circular reveal from the top right corner, as a CSS animation on the View
 * Transition snapshot. CSS (not Element.animate) so the browser keeps the
 * transition alive until it ends; percentages so it follows the snapshot box.
 * A circle() radius percentage is relative to diagonal / √2: 150% (> √2 ≈ 141%)
 * reaches past the opposite corner.
 */
export const THEME_TRANSITION_CSS = `@keyframes theme-reveal {
  from { clip-path: circle(0% at 100% 0%); }
  to { clip-path: circle(150% at 100% 0%); }
}
:root[${THEME_TRANSITION_ATTRIBUTE}]::view-transition-old(root) {
  animation: none;
}
:root[${THEME_TRANSITION_ATTRIBUTE}]::view-transition-new(root) {
  animation: theme-reveal 650ms cubic-bezier(0.4, 0, 0.2, 1) both;
  mix-blend-mode: normal;
}`;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Runs `apply` (which must update the DOM synchronously) inside a View
 * Transition revealed by THEME_TRANSITION_CSS (injected with the themes CSS).
 * Plain switch without View Transitions support, with reduced motion, or when
 * `animate` is false.
 */
export function switchThemeWithTransition(apply: () => void, animate = true): void {
  const doc = document as ViewTransitionDocument;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reducedMotion || typeof doc.startViewTransition !== 'function') {
    apply();
    return;
  }

  const root = document.documentElement;
  root.setAttribute(THEME_TRANSITION_ATTRIBUTE, '');
  const transition = doc.startViewTransition(apply);
  // Also settles when the transition is skipped (hidden tab, interrupted): the theme is applied anyway.
  void transition.finished.catch(() => undefined).finally(() => root.removeAttribute(THEME_TRANSITION_ATTRIBUTE));
}
