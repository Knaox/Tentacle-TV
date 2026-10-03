import { cardActionEntries, type CardOverlay, type CardStatusKind, type CardToggleStates } from "@tentacle-tv/shared";

/**
 * Les PICTOS du grand panneau, dans l'ordre du survol du bureau : ce que le
 * modèle partagé offre (`cardActionEntries` — la lecture toujours en tête : le
 * panneau remplace la carte —, Ma liste → favori → vu, puis les extras), plus
 * ce que le SALON ajoute, et seulement lui :
 * - « Plus d'infos » sur TOUTE carte de la bibliothèque, affiche comprise (au
 *   bureau, le clic d'une affiche ouvre la fiche ; à la télécommande, le
 *   panneau la propose aussi), à sa place d'extra : avant « Ne plus me
 *   proposer », sinon au bout ;
 * - « Toutes les plateformes » au bout, sur une recommandation, sous un filtre
 *   de plateformes actif.
 * La note n'en est pas : elle a son échelle, au-dessus des pictos.
 *
 * GAUCHE / DROITE passent d'un picto à son voisin, dans cet ordre, sans
 * boucler ; le guide du groupe entre par la lecture, puis par le dernier
 * picto visité (`sheetEntry`).
 */

/** Ce que fait un picto : les actions du modèle partagé, plus celles du salon. */
export type SheetActionKind = "play" | "request" | CardStatusKind | "details" | "dismiss" | "offline" | "providersAll";

export interface SheetActionEntry {
  kind: SheetActionKind;
  /** La clé i18n du libellé, espace compris (`cards:addToWatchlist`) : il dit ce que fera le geste. */
  labelKey: string;
  /** Une bascule posée : son glyphe se remplit. */
  active?: boolean;
  /** D'où vient le picto : le modèle partagé du survol, ou le salon (« Plus d'infos », « Toutes les plateformes »). */
  origin: "model" | "salon";
}

export interface SheetActionsInput {
  overlay: CardOverlay;
  states: CardToggleStates;
  /** La carte vient de la bibliothèque : sa fiche existe, « Plus d'infos » y mène. */
  inLibrary: boolean;
  /** Un filtre de plateformes est actif (recommandation) : « Toutes les plateformes » suit. */
  providerFilterActive?: boolean;
}

export function sheetActionEntries(input: SheetActionsInput): SheetActionEntry[] {
  const rows: SheetActionEntry[] = cardActionEntries(input.overlay, input.states).map((entry) => ({
    kind: entry.kind,
    labelKey: `cards:${entry.labelKey}`,
    active: entry.active,
    origin: "model",
  }));
  if (input.inLibrary && !rows.some((row) => row.kind === "details")) {
    const dismiss = rows.findIndex((row) => row.kind === "dismiss");
    rows.splice(dismiss === -1 ? rows.length : dismiss, 0, { kind: "details", labelKey: "cards:moreInfo", origin: "salon" });
  }
  if (input.overlay.variant === "reco" && input.providerFilterActive) {
    rows.push({ kind: "providersAll", labelKey: "reco:providersAll", origin: "salon" });
  }
  return rows;
}
