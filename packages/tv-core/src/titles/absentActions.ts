/**
 * OK sur un titre ABSENT de la bibliothèque — un volet de la saga d'un film, une
 * carte de la rangée « À demander » de la recherche, l'onglet grisé d'une
 * saison manquante sur la fiche d'une série. Module pur : la plateforme lit
 * l'état du titre, demande, montre l'avis ou la feuille des saisons. Rien de
 * tout cela n'existe sans la garde des demandes (`titlesGate`).
 */

/** Avant de lire l'état du titre : ce que le compte et l'arrivée en disent déjà (VI-1). */
export type AbsentPressFirst =
  /** Le compte l'a déjà demandé : l'avis de son état, jamais une seconde demande. */
  | "noticeMine"
  /** Arrivé depuis peu : l'avis « Disponible ». */
  | "noticeArrived"
  /** Une demande déjà en vol pour ce titre : rien (pas de double envoi). */
  | "busy"
  /** Lire l'état du titre, puis `absentPressAfterState`. */
  | "readState";

export function absentPressFirst(title: { mine: boolean; arrived: boolean; busy: boolean }): AbsentPressFirst {
  if (title.busy) return "busy";
  if (title.mine) return "noticeMine";
  return title.arrived ? "noticeArrived" : "readState";
}

/** Ce que dit l'extension d'un titre, vu d'ici. */
export interface AbsentTitleOffer {
  /** Ce qu'elle offre : la demande en un geste (`direct`), une demande à préciser (`open`), rien. */
  offer: "direct" | "open" | null;
  /** Une série (ses saisons se choisissent). */
  series: boolean;
  /** L'extension sait dire les saisons d'une série (`titles.seasons`). */
  seasons: boolean;
  /** Un état à dire (« Demandé »…). */
  badge: boolean;
}

/** L'état lu (VI-1) : demander, ouvrir la feuille des saisons, ou un avis. */
export type AbsentPressAfterState = "request" | "seasonsSheet" | "noticeBadge" | "noticeUnavailable";

export function absentPressAfterState(title: AbsentTitleOffer): AbsentPressAfterState {
  if (title.offer === "direct") return "request";
  if (title.offer === "open" && title.series && title.seasons) return "seasonsSheet";
  return title.badge ? "noticeBadge" : "noticeUnavailable";
}

/**
 * OK sur l'onglet grisé d'une saison manquante (VI-2) : la demander seule, sans
 * feuille — le focus reste sur l'onglet, qui prend son état ; sinon (déjà
 * demandée, pas demandable) l'avis de son état.
 */
export function gapTabPress(tab: { requestable: boolean }): "requestSeason" | "noticeState" {
  return tab.requestable ? "requestSeason" : "noticeState";
}

/**
 * OK sur une série INCOMPLÈTE de la rangée « À demander » (VI-3) : la feuille
 * de ses saisons quand il en reste à demander ; sinon, une demande du compte
 * en cours → son avis ; sinon rien.
 */
export function seriesGapPress(gap: { missing: number; mine: boolean }): "seasonsSheet" | "noticeMine" | "none" {
  if (gap.missing > 0) return "seasonsSheet";
  return gap.mine ? "noticeMine" : "none";
}
