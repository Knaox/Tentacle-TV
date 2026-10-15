import { createContext, useContext } from "react";
import { DEFAULT_ROW_HEAD_OPTIONS, type RowHeadOptions } from "@tentacle-tv/tv-core";

/**
 * Le PORT de l'essai « la carte en aperçu passe en tête » (tv-core
 * `trailerPreviewRowHead.ts`) : ce que fait une rangée en bout de course
 * (`end`) et quand le focus la quitte (`release`).
 *
 * Les vues ne lisent pas le stockage : l'app branche ce fournisseur sur le
 * réglage d'essai du téléviseur (`lib/rowHeadTrial.ts`, monté dans `App.tsx`) ;
 * sans fournisseur (le banc), le choix par défaut.
 */
const RowHeadContext = createContext<RowHeadOptions>(DEFAULT_ROW_HEAD_OPTIONS);

export const RowHeadProvider = RowHeadContext.Provider;

export function useRowHeadOptions(): RowHeadOptions {
  return useContext(RowHeadContext);
}
