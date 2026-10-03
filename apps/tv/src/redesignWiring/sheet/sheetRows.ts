import { sheetActionEntries, type SheetActionsInput } from "@tentacle-tv/tv-core";
import type { SheetActionModel } from "../../redesign/screens/sheet/ActionSheetView";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface SheetRowsInput extends SheetActionsInput {
  /** Le complément de la lecture : l'épisode (S02E05), la position (12:34). */
  playDetail?: string | null;
}

/**
 * Les pictos du grand panneau, mis en mots : leur ORDRE est la règle de
 * tv-core (`cards/sheetActions` — le modèle partagé, la lecture en tête,
 * « Plus d'infos » sur toute carte de la bibliothèque, « Toutes les
 * plateformes » sous un filtre actif) ; ici, leurs libellés et le complément
 * de la lecture. Le branchement (`useSheetModel`) et le banc en tirent les
 * mêmes pictos.
 */
export function sheetRows(input: SheetRowsInput, t: Translate): SheetActionModel[] {
  return sheetActionEntries(input).map((entry) => ({
    kind: entry.kind,
    label: t(entry.labelKey),
    active: entry.active,
    detail: entry.kind === "play" ? input.playDetail ?? null : null,
  }));
}
