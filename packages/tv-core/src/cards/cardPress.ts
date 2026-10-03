import type { HoldSource } from "./cardHold";

/**
 * L'appui SIMPLE sur une carte (OK) : ce qu'il fait, selon d'où vient la
 * carte — le pendant de `cardHold.ts` (l'appui maintenu), sur les mêmes
 * sources. Rien ne se fait SUR la carte : OK fait l'action principale.
 *
 * - Une vignette d'ÉPISODE (Reprendre, Prochains épisodes, Déjà vu, les
 *   épisodes de la recherche et de la fiche) : la lecture.
 * - Une affiche : la fiche — celle de l'item d'une recommandation, d'un volet
 *   de saga présent, d'un titre similaire ou de la collection.
 * - Un titre HORS de la bibliothèque (rangée « À demander », volet de saga
 *   absent qui se demande) ou une série à compléter : la demande (Vigie).
 * - Un volet de saga absent qu'on ne peut pas demander : l'avis « pas dans
 *   la bibliothèque » — rien ne s'ouvre.
 *
 * Les boutons du héros ne sont pas des cartes : chacun a son action (la
 * lecture, « Plus d'infos », Ma liste) ; ils n'ont pas de source ici. Le volet
 * de saga AFFICHÉ (la fiche où l'on est) ne fait rien : l'intégration le
 * sait, pas la carte.
 */

/** Ce que fait OK sur une carte. */
export type CardPress = "play" | "detail" | "request" | "notInLibrary";

/** Les sources d'une carte : celles de l'appui maintenu, sauf le héros (des boutons). */
export type PressSource = Exclude<HoldSource, { surface: "hero" }>;

/** Les rangées d'épisodes de l'accueil sont des vignettes : OK les lit. */
const PLAY_ROWS: ReadonlySet<string> = new Set(["resume", "nextUp", "watched"]);

export function cardPressOf(source: PressSource): CardPress {
  switch (source.surface) {
    case "homeRow":
      return PLAY_ROWS.has(source.row) ? "play" : "detail";
    case "forYou":
    case "grid":
      return "detail";
    case "search":
      if (source.card === "episode") return "play";
      return source.card === "title" ? "detail" : "request";
    case "detail":
      if (source.card === "episode") return "play";
      if (source.card === "sagaAbsent") return source.requestable ? "request" : "notInLibrary";
      return "detail";
  }
}
