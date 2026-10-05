/**
 * Le RECUL des voisines d'une carte focalisée dans une rangée : quand le focus
 * quitte la rangée, elles reviennent — mais « aucune » n'est dit qu'après
 * `releaseMs` : la perte du focus d'une carte arrive souvent AVANT la prise de
 * la suivante, et les voisines ne doivent pas se rallumer entre deux pas.
 * L'opacité, la durée et la courbe du recul sont les jetons du thème
 * (`TV_STAGE.focus.recede`, `TV_MOTION.focus.recedeMs`, `TV_MOTION.curve.inOut`).
 *
 * Deux mises en œuvre lisent la règle : Reanimated
 * (`apps/tv/src/redesign/motion/useRowRecede.ts`) et, sur Android TV, la piste
 * native (`TentacleCullTrack` → `RowRecede.kt`, qui reçoit ces valeurs en
 * props) : une rangée de l'accueil, c'est une vingtaine de cartes qui
 * reculent à chaque pas vertical — ~4 ms de fil d'interface par image sur la
 * Shield quand Reanimated les animait une à une (mesuré, 2026-10-05).
 */
export const ROW_RECEDE = {
  releaseMs: 32,
} as const;
