import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Tracks the OS-level reduced motion preference, live. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Global multiplier for ambient scene motion (orbits, spins, drifts).
 * Near zero rather than zero under reduced motion so the scene still
 * reads as alive in stills without actually moving much.
 */
export function useMotionScale(): number {
  return useReducedMotion() ? 0.02 : 1;
}
