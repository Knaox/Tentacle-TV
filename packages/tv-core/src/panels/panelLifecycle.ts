/**
 * Le CYCLE d'un panneau présenté en `Modal` — le grand panneau d'une carte,
 * celui d'un titre absent, la feuille des saisons :
 *
 * 1. ouvert, il attend son entrée (`sheetEntry`, `seasonsSheet`) : il ne se
 *    PRÉSENTE qu'une fois elle décidée — dans une `Modal` présentée, plus rien
 *    ne déplace le focus ;
 * 2. présenté, il garde le focus (la `Modal` le piège) ;
 * 3. fermé — Retour, la croix, une action qui le quitte —, il joue sa sortie,
 *    puis se retire ; le focus revient à ce qui l'avait ouvert (la carte,
 *    « Noter », l'onglet d'une fiche). Sur tvOS, ce retour est natif : le
 *    contrôleur qui présentait la `Modal` restaure son focus.
 *
 * Retour est une couche « menu » de la pile du Retour (`nav/backResolve`),
 * active dès l'ouverture : un Retour parti avant que le panneau ne paraisse
 * le ferme aussi.
 */

import type { BackLayerSpec } from "../nav/backResolve";

export type PanelKind = "card" | "absent" | "seasons";

/** Ce que fait Retour sur un panneau : le fermer. */
export type PanelBackAction = "close";

/** La couche du Retour d'un panneau, déclarée en pur. */
export type PanelBackLayer = BackLayerSpec<PanelBackAction>;

/**
 * Les couches du Retour d'un panneau. Le grand panneau et la feuille des
 * saisons coupent la leur pendant leur sortie ; celui d'un titre absent la
 * garde (une fermeture déjà en cours, relancée, ne change rien).
 */
export function panelBackLayers(panel: PanelKind, closing: boolean): PanelBackLayer[] {
  const active = panel === "absent" ? true : !closing;
  return [{ id: `panel:${panel}`, kind: "menu", active, action: "close" }];
}

/** Le panneau se présente une fois son entrée décidée. */
export function panelPresented(entry: string | null): boolean {
  return entry !== null;
}

/**
 * Fermer un panneau qui n'a pas encore paru : la feuille des saisons part
 * tout de suite ; les deux autres jouent leur sortie, qui ne se joue qu'une
 * fois leur entrée décidée (le panneau, alors présenté invisible, se retire
 * aussitôt).
 */
export function closesAtOnce(panel: PanelKind, presented: boolean): boolean {
  return panel === "seasons" && !presented;
}

/** Deux `Modal` qui se suivent (le panneau d'un titre absent, puis la feuille de
 *  ses saisons) : présentée pendant le retrait de la précédente, la suivante ne
 *  paraîtrait pas. */
export const MODAL_GAP_MS = 320;
