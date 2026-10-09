export type TransitionOrigin = { x: number; y: number };
type Viewport = { width: number; height: number };

const DURATION_MS = 650;
/** A little past the farthest corner, so no anti-aliased edge is left when the circle stops. */
const RADIUS_MARGIN_PX = 2;

/** The reveal starts from the top right corner of the viewport. */
export function revealOrigin(viewport: Viewport): TransitionOrigin {
  return { x: viewport.width, y: 0 };
}

/** Radius from `origin` to the farthest corner of the viewport, plus a small margin. */
export function revealRadius(origin: TransitionOrigin, viewport: Viewport): number {
  return (
    Math.hypot(Math.max(origin.x, viewport.width - origin.x), Math.max(origin.y, viewport.height - origin.y)) +
    RADIUS_MARGIN_PX
  );
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> };
};

/**
 * Runs `apply` (which must update the DOM synchronously) inside a View
 * Transition: the new theme grows as a circle from the top right corner until
 * it covers the whole page. Plain switch without View Transitions support,
 * with reduced motion, or when `animate` is false. The host app disables the
 * default cross-fade on `::view-transition-old/new(root)`.
 */
export function switchThemeWithTransition(apply: () => void, animate = true): void {
  const doc = document as ViewTransitionDocument;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reducedMotion || typeof doc.startViewTransition !== 'function') {
    apply();
    return;
  }

  // The snapshot covers the layout viewport (without the scrollbar).
  const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
  const origin = revealOrigin(viewport);
  const radius = revealRadius(origin, viewport);
  const transition = doc.startViewTransition(apply);
  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: DURATION_MS,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'both',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    // Aborted transitions (hidden tab, interrupted) still applied the theme.
    .catch(() => undefined);
}
