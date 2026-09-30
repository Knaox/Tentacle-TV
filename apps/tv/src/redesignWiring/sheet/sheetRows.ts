import { cardActionEntries, type CardOverlay, type CardToggleStates } from "@tentacle-tv/shared";
import type { SheetActionModel } from "../../redesign/screens/sheet/ActionSheetView";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface SheetRowsInput {
  overlay: CardOverlay;
  states: CardToggleStates;
  /** Le complément de la lecture : l'épisode (S02E05), la position (12:34). */
  playDetail?: string | null;
  /** La carte vient de la bibliothèque : sa fiche existe, « Plus d'infos » y mène. */
  inLibrary: boolean;
  /** Un filtre de plateformes est actif (recommandation) : « Toutes les plateformes » suit. */
  providerFilterActive?: boolean;
}

/**
 * Les pictos du grand panneau, dans l'ordre du survol du bureau : ce que le
 * modèle partagé offre (`cardActionEntries` — la lecture toujours en tête,
 * le panneau remplace la carte), plus ce que le SALON ajoute, et seulement
 * lui :
 * - « Plus d'infos » sur TOUTE carte de la bibliothèque, affiche comprise : au
 *   bureau, le clic d'une affiche ouvre la fiche ; à la télécommande, le
 *   panneau la propose aussi, à sa place d'extra (avant « Ne plus me
 *   proposer ») ;
 * - « Toutes les plateformes » sous un filtre actif.
 * La note n'en est pas : elle a son échelle, au-dessus des pictos.
 * Pur : le branchement (`useSheetModel`) et le banc en tirent les mêmes pictos.
 */
export function sheetRows(input: SheetRowsInput, t: Translate): SheetActionModel[] {
  const rows: SheetActionModel[] = cardActionEntries(input.overlay, input.states).map((entry) => ({
    kind: entry.kind,
    label: t(`cards:${entry.labelKey}`),
    active: entry.active,
    detail: entry.kind === "play" ? input.playDetail ?? null : null,
  }));
  if (input.inLibrary && !rows.some((row) => row.kind === "details")) {
    const dismiss = rows.findIndex((row) => row.kind === "dismiss");
    rows.splice(dismiss === -1 ? rows.length : dismiss, 0, { kind: "details", label: t("cards:moreInfo") });
  }
  if (input.overlay.variant === "reco" && input.providerFilterActive) {
    rows.push({ kind: "providersAll", label: t("reco:providersAll") });
  }
  return rows;
}
