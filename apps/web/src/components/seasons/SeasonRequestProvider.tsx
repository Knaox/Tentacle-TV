import { createContext, lazy, Suspense, useCallback, useContext, useState, type ReactNode } from "react";
import type { TitleKey } from "@tentacle-tv/shared";

/**
 * La feuille des saisons à demander, UNE pour toute l'application : la page de
 * résultats l'ouvre depuis le plateau d'une carte ou le meilleur résultat,
 * l'omnibox depuis sa ligne « 2 saisons à demander » — après s'être
 * refermée. Montée au-dessus des pages et de l'omnibox (`App.tsx`), chargée à
 * la première ouverture ; elle garde sa dernière série le temps de sa sortie.
 */

/** La série dont on demande les saisons. */
export interface SeasonRequestTarget {
  /** La série dans la bibliothèque (Jellyfin) : ses saisons présentes ne se cochent pas. */
  seriesId: string;
  /** Sa clé TMDB, celle que l'extension connaît. */
  key: TitleKey;
  name: string;
}

type OpenSeasonRequest = (target: SeasonRequestTarget) => void;

const SeasonRequestContext = createContext<OpenSeasonRequest | null>(null);

const SeasonRequestDialog = lazy(() => import("./SeasonRequestDialog").then((m) => ({ default: m.SeasonRequestDialog })));

interface DialogState {
  target: SeasonRequestTarget;
  open: boolean;
  /** Une ouverture neuve repart de zéro (rien de coché), même pour la même série. */
  seq: number;
}

export function SeasonRequestProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const open = useCallback((target: SeasonRequestTarget) => {
    setState((current) => ({ target, open: true, seq: (current?.seq ?? 0) + 1 }));
  }, []);
  const close = useCallback(() => setState((current) => (current ? { ...current, open: false } : current)), []);
  return (
    <SeasonRequestContext.Provider value={open}>
      {children}
      {state && (
        <Suspense fallback={null}>
          <SeasonRequestDialog key={state.seq} target={state.target} open={state.open} onClose={close} />
        </Suspense>
      )}
    </SeasonRequestContext.Provider>
  );
}

/** Ouvre la feuille des saisons ; `null` hors du fournisseur (rien n'est offert). */
export function useSeasonRequest(): OpenSeasonRequest | null {
  return useContext(SeasonRequestContext);
}
