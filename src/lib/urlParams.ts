/**
 * Read-once URL parameters, immutable after load.
 * ?u=<login> deep-links to a profile (embeds link back through this),
 * ?snap hides the HUD for clean poster captures and iframe embeds.
 */
const params =
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);

export const urlLogin: string | null = params?.get('u') ?? null;
export const snapMode: boolean = params?.has('snap') ?? false;
