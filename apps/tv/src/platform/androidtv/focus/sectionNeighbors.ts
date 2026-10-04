import { REPEAT_PACING } from "@tentacle-tv/tv-core";

/**
 * Android TV — la règle de voisinage des SECTIONS, comme sur Apple TV
 * (`platform/tvos/focus/sectionNeighbors.ts`) : toute `FocusSection` liée par
 * un magasin de focus la reçoit (`focusStore.ts`, forme `section`), et la
 * section native (`android/.../focus/TentacleFocusSection.kt`) l'applique au
 * geste — la règle de `@tentacle-tv/tv-core` (`focus/sections.ts`).
 *
 * En plus, ce que seule une télécommande qui RÉPÈTE la flèche tenue demande :
 * la cadence du focus (`input/repeatPacing.ts`), passée telle quelle à la
 * section native — aucune constante ici, aucune là-bas.
 */
export const SECTION_NEIGHBORS: Readonly<Record<string, unknown>> = Object.freeze({
  tvNeighbors: true,
  tvPacing: REPEAT_PACING,
});
