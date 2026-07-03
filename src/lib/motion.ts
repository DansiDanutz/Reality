/** CSS animations honor prefers-reduced-motion via global.css; JS-driven motion asks here. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
