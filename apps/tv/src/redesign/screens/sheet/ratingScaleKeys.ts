/**
 * Les crans de l'échelle de la note, et leurs clés de focus — partagés par la
 * vue (`RatingRuler`) et le câblage, qui y pose l'entrée du panneau.
 */

/** Les valeurs du bureau : 1 à 10, une étoile = 2 (demi-étoiles comprises). */
export const RATING_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Le cran d'entrée sans note posée : 5/10, deux étoiles et demie — jamais un bout de
 *  l'échelle, qu'un OK réflexe validerait. */
export const RATING_ENTRY = 5;

/** La clé d'un cran (`sheet:scale:7`), ou du retrait (`sheet:scale:remove`). */
export const scaleFocusKey = (score: number | null): string => `sheet:scale:${score ?? "remove"}`;

/** Toutes les clés de l'échelle, retrait compris. */
export const SCALE_FOCUS_KEYS: readonly string[] = [...RATING_SCORES.map(scaleFocusKey), scaleFocusKey(null)];

/** Ce que vise une clé de l'échelle : un cran, le retrait, ou rien. */
export function scaleAimOf(key: string | null): number | "remove" | null {
  if (!key?.startsWith("sheet:scale:")) return null;
  const rest = key.slice("sheet:scale:".length);
  if (rest === "remove") return "remove";
  const score = Number(rest);
  return Number.isInteger(score) && score >= 1 && score <= 10 ? score : null;
}
