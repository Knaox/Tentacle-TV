import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useSeasonRequest } from "./SeasonRequestProvider";
import { useSeriesGaps } from "./useSeriesGaps";

/**
 * La portée des séries INCOMPLÈTES d'une page de résultats : ses cartes y
 * lisent si leur série a des saisons à demander — « Demander » au plateau du
 * survol (`CardHoverOverlay`), « 2 saisons à demander » sous l'affiche, un
 * bouton sur le meilleur résultat. Hors de cette portée (accueil,
 * bibliothèques, filmographies), aucune carte n'offre rien : c'est dans la
 * recherche qu'on complète une série.
 */

export interface SeriesGapOffer {
  /** Combien de saisons se demandent encore. */
  count: number;
  /** Ouvre la feuille des saisons de la série. */
  open: () => void;
}

type OfferOf = (itemId: string) => SeriesGapOffer | null;

const SeriesGapsContext = createContext<OfferOf | null>(null);

export function SeriesGapsScope({ items, children }: {
  /** Les titres de la page ; seules les séries comptent. */
  items: ReadonlyArray<{ Id: string; Name: string; Type?: string; ProviderIds?: Record<string, string> }>;
  children: ReactNode;
}) {
  const gaps = useSeriesGaps(items);
  const openSeasons = useSeasonRequest();
  const offerOf = useCallback<OfferOf>((itemId) => {
    const gap = gaps.get(itemId);
    if (!gap || !openSeasons) return null;
    return { count: gap.count, open: () => openSeasons({ seriesId: gap.seriesId, key: gap.key, name: gap.name }) };
  }, [gaps, openSeasons]);
  return <SeriesGapsContext.Provider value={offerOf}>{children}</SeriesGapsContext.Provider>;
}

/** Ce que la carte d'un titre offre de compléter ; `null` hors de la portée, ou rien à demander. */
export function useSeriesGapOffer(itemId: string | null | undefined): SeriesGapOffer | null {
  const offerOf = useContext(SeriesGapsContext);
  return offerOf && itemId ? offerOf(itemId) : null;
}
