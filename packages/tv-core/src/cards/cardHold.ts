/**
 * L'APPUI MAINTENU d'une carte : quel panneau il ouvre, selon d'où vient la
 * carte. Sur Apple TV, rien ne se fait SUR la carte : OK fait l'action
 * principale (la fiche d'une affiche, la lecture d'une vignette), l'appui
 * maintenu ouvre le grand panneau — dans la forme de la carte (affiche 2:3 ou
 * vignette 16:9 : la note d'une vignette d'épisode est la sienne, celle d'une
 * affiche est celle de la série), celui d'une recommandation, ou celui d'un
 * titre ABSENT de la bibliothèque (garde Vigie ouverte). `null` : la carte ne
 * s'ouvre pas par l'appui maintenu — et ne le dit pas (pas d'indication).
 *
 * « Noter » de la fiche ouvre le même panneau réduit à la note, sur l'item de
 * la fiche (`rateTargetVariant`).
 */

/** Le panneau qu'ouvre l'appui maintenu. */
export type HoldPanel =
  | { kind: "media"; variant: "poster" | "landscape" }
  | { kind: "reco" }
  | { kind: "absent" };

/** Une rangée de l'accueil, par sa nature. */
export type HomeRowKind = "resume" | "nextUp" | "watched" | "watchlist" | "favorites" | "library" | "reco";

/** Une carte de la fiche. */
export type DetailCardKind = "episode" | "sagaPresent" | "sagaAbsent" | "similar" | "collection";

/** Une carte de la recherche. */
export type SearchCardKind = "episode" | "title" | "librarySeries" | "absentTitle";

/** D'où vient la carte tenue. */
export type HoldSource =
  | { surface: "homeRow"; row: HomeRowKind }
  /** Les boutons du héros de l'accueil : le titre affiché, dans la forme de sa source. */
  | { surface: "hero"; fromResume: boolean }
  | { surface: "forYou" }
  /** `librarySeries` : une série de la bibliothèque à compléter, rangée « À demander ». */
  | { surface: "search"; card: SearchCardKind }
  /** `requestable` : un volet absent se demande (garde Vigie ouverte, titre connu). */
  | { surface: "detail"; card: DetailCardKind; requestable?: boolean }
  /** Bibliothèque, collection, Ma liste, Favoris, Parcourir : des affiches. */
  | { surface: "grid" };

const POSTER: HoldPanel = { kind: "media", variant: "poster" };
const LANDSCAPE: HoldPanel = { kind: "media", variant: "landscape" };
const RECO: HoldPanel = { kind: "reco" };
const ABSENT: HoldPanel = { kind: "absent" };

/** Les rangées d'épisodes sont des vignettes : « Reprendre », « Prochains épisodes », « Déjà vu ». */
const LANDSCAPE_ROWS: ReadonlySet<HomeRowKind> = new Set(["resume", "nextUp", "watched"]);

export function holdPanelOf(source: HoldSource): HoldPanel | null {
  switch (source.surface) {
    case "homeRow":
      if (source.row === "reco") return RECO;
      return LANDSCAPE_ROWS.has(source.row) ? LANDSCAPE : POSTER;
    case "hero":
      return source.fromResume ? LANDSCAPE : POSTER;
    case "forYou":
      return RECO;
    case "search":
      if (source.card === "episode") return LANDSCAPE;
      if (source.card === "absentTitle") return ABSENT;
      // Une série de la bibliothèque à compléter : le panneau de la série.
      return POSTER;
    case "detail":
      if (source.card === "episode") return LANDSCAPE;
      if (source.card === "sagaAbsent") return source.requestable ? ABSENT : null;
      return POSTER;
    case "grid":
      return POSTER;
  }
}

/** Le panneau d'une carte : ses pictos et sa note (`actions`), ou sa note seule (`rate` : « Noter » de la fiche). */
export type SheetMode = "actions" | "rate";

/** Les pictos ne paraissent que dans le grand panneau : réduit à la note, il ne résout pas la lecture. */
export function sheetShowsActions(mode: SheetMode): boolean {
  return mode === "actions";
}

/** OK sur un cran ferme le panneau réduit à la note ; dans le grand panneau, la note se pose
 *  sous les yeux et le panneau reste ouvert. */
export function ratingClosesSheet(mode: SheetMode): boolean {
  return mode === "rate";
}

/** « Noter » de la fiche : la note d'un épisode est la sienne (vignette), celle d'un film,
 *  d'une série ou d'une collection, l'affiche. */
export function rateTargetVariant(itemType: string): "poster" | "landscape" {
  return itemType === "Episode" ? "landscape" : "poster";
}
