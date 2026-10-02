import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useSeriesGaps, type SeriesGapItem } from "@tentacle-tv/api-client";
import { useTitleProvider } from "@/components/external/useExternalTitle";
import { SeasonRequestSheet, type SeasonRequestTarget } from "./SeasonRequestSheet";

/**
 * La portée des séries INCOMPLÈTES de la recherche : une question à
 * l'extension pour toute la page (`useSeriesGaps`, contrat `titles.gaps`), et
 * la feuille des saisons qu'elle ouvre. Ses cartes y lisent si leur série a
 * des saisons à demander — « 2 saisons à demander » sous l'affiche, le bouton
 * de la feuille d'appui long (`MediaActionSheet`). Hors de cette portée, rien
 * n'est offert : c'est dans la recherche qu'on complète une série.
 *
 * Elle ENVELOPPE la portée des feuilles d'appui long (`CardSheetScope`) : la
 * feuille des cartes la lit. Et la feuille des saisons se présente depuis la
 * recherche elle-même, une modale (cf. `CardSheetScope`).
 */

export interface SeriesGapOffer {
  /** Combien de saisons se demandent encore. */
  count: number;
  /** Ouvre la feuille des saisons de la série. */
  open: () => void;
}

type OfferOf = (itemId: string) => SeriesGapOffer | null;

const SeriesGapsContext = createContext<OfferOf | null>(null);

export function SeriesGapsScope({ items, children }: { items: readonly SeriesGapItem[]; children: ReactNode }) {
  const { provider, lang } = useTitleProvider();
  const gaps = useSeriesGaps(provider, items, lang);
  const [target, setTarget] = useState<SeasonRequestTarget | null>(null);
  const offerOf = useCallback<OfferOf>((itemId) => {
    const gap = gaps.get(itemId);
    if (!gap) return null;
    return { count: gap.count, open: () => setTarget({ seriesId: gap.seriesId, key: gap.key, name: gap.name }) };
  }, [gaps]);
  const close = useCallback(() => setTarget(null), []);
  return (
    <SeriesGapsContext.Provider value={offerOf}>
      {children}
      <SeasonRequestSheet target={target} onClose={close} />
    </SeriesGapsContext.Provider>
  );
}

/** Ce que la carte d'un titre offre de compléter ; `null` hors de la portée, ou rien à demander. */
export function useSeriesGapOffer(itemId: string | null | undefined): SeriesGapOffer | null {
  const offerOf = useContext(SeriesGapsContext);
  return offerOf && itemId ? offerOf(itemId) : null;
}
