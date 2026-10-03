/**
 * L'horloge et les minuteurs des machines du lecteur, INJECTÉS : tv-core n'en
 * arme aucun de lui-même (règle de pureté). Le lecteur passe ceux du moteur JS
 * (`apps/tv` `hooks/playerTimers.ts`), les tests une horloge factice.
 */
export interface PlayerTimers {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}
