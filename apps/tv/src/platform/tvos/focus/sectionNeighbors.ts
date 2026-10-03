/**
 * La règle de voisinage des SECTIONS de la refonte — posée ici, une fois, pour
 * tous les écrans : toute `FocusSection` liée par un magasin de focus la reçoit
 * (`focusStore.ts`, forme `section`).
 *
 * HAUT / BAS depuis un élément d'une section atterrit dans la section voisine
 * dès qu'elle a un élément focalisable, sur celui dont le centre est le plus
 * proche horizontalement — la règle de `@tentacle-tv/tv-core`
 * (`focus/sections.ts`), que la section native d'Apple TV applique au moment
 * du geste (`ios/TentacleTV/TentacleFocusNeighbors.m`).
 *
 * Une section peut déclarer son ENTRÉE (`tvEntry`, le numéro natif d'un de ses
 * éléments, posé sur son nœud) : l'onglet de la saison affichée, l'épisode à
 * reprendre — la fiche, par `sectionEntry.ts`.
 */
export const SECTION_NEIGHBORS: Readonly<Record<string, unknown>> = Object.freeze({ tvNeighbors: true });
