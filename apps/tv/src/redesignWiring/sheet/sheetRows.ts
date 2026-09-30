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
  /** La note, quand le titre se note (`overlay.rate`) : la ligne « Noter » suit la lecture. */
  rating?: { current: number | null; pending?: boolean } | null;
}

/**
 * Les lignes de la feuille d'actions, dans l'ordre du survol du bureau : ce
 * que le modèle partagé offre (`cardActionEntries` — la lecture toujours en
 * tête, la feuille remplace la carte), plus ce que le SALON ajoute, et
 * seulement lui :
 * - « Noter », juste après la lecture (l'ordre du survol du bureau : Lire, la
 *   note, puis les bascules) : elle ouvre l'échelle verticale de la note ; son
 *   complément dit la note posée (« 8/10 ») ;
 * - « Plus d'infos » sur TOUTE carte de la bibliothèque, affiche comprise : au
 *   bureau, le clic d'une affiche ouvre la fiche ; à la télécommande, la
 *   feuille la propose aussi, à sa place d'extra (avant « Ne plus me
 *   proposer ») ;
 * - « Toutes les plateformes » sous un filtre actif.
 * Pur : le branchement (`useSheetModel`) et le banc en tirent les mêmes lignes.
 */
export function sheetRows(input: SheetRowsInput, t: Translate): SheetActionModel[] {
  const rows: SheetActionModel[] = cardActionEntries(input.overlay, input.states).map((entry) => ({
    kind: entry.kind,
    label: t(`cards:${entry.labelKey}`),
    active: entry.active,
    detail: entry.kind === "play" ? input.playDetail ?? null : null,
  }));
  const { rating } = input;
  if (rating) {
    const rated = rating.current !== null;
    rows.splice(rows[0]?.kind === "play" ? 1 : 0, 0, {
      kind: "rate",
      label: rated ? t("reco:yourRating") : t("cards:rateTitle"),
      detail: rating.pending ? "…" : rated ? t("reco:ratingValue", { score: rating.current }) : null,
      active: rated,
    });
  }
  if (input.inLibrary && !rows.some((row) => row.kind === "details")) {
    const dismiss = rows.findIndex((row) => row.kind === "dismiss");
    rows.splice(dismiss === -1 ? rows.length : dismiss, 0, { kind: "details", label: t("cards:moreInfo") });
  }
  if (input.overlay.variant === "reco" && input.providerFilterActive) {
    rows.push({ kind: "providersAll", label: t("reco:providersAll") });
  }
  return rows;
}
