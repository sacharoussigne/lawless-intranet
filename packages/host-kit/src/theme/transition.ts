export type TransitionOrigin = { x: number; y: number };

const DURATION_MS = 500;

/** Radius from `origin` to the farthest corner of the viewport. */
export function revealRadius(origin: TransitionOrigin, viewport: { width: number; height: number }): number {
  return Math.hypot(Math.max(origin.x, viewport.width - origin.x), Math.max(origin.y, viewport.height - origin.y));
}

/** Center of an element, as the origin of the reveal circle. */
export function originOf(element: Element | null | undefined): TransitionOrigin | undefined {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

/**
 * Runs `apply` (which must update the DOM synchronously) inside a View
 * Transition: the new theme grows as a circle from `origin`. Plain switch
 * without View Transitions support, with reduced motion or without an origin.
 * The host app disables the default cross-fade on `::view-transition-old/new(root)`.
 */
export function switchThemeWithTransition(apply: () => void, origin?: TransitionOrigin): void {
  const doc = document as ViewTransitionDocument;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!origin || reducedMotion || typeof doc.startViewTransition !== 'function') {
    apply();
    return;
  }

  const transition = doc.startViewTransition(apply);
  const radius = revealRadius(origin, { width: window.innerWidth, height: window.innerHeight });
  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        { duration: DURATION_MS, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => undefined);
}
