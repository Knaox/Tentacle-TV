import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useSeriesRatings } from "@tentacle-tv/api-client";
import { missingSeriesRatingIds, type MediaItem } from "@tentacle-tv/shared";

/**
 * Les notes de séries résolues pour une rangée, mises à la disposition de ses
 * cartes. Le jumeau du contexte du web, et pour la même raison : la note d'un
 * lot « +N » ne vient pas de la tuile — elle est fabriquée côté client, sans
 * rien de la série — mais d'une requête groupée que la rangée déclenche.
 *
 * Le défaut est une carte vide GELÉE au niveau module : les écrans qui ne
 * fournissent rien ne paient pas même une allocation par rendu.
 */
const EMPTY: ReadonlyMap<string, number> = new Map();

const SeriesRatingContext = createContext<ReadonlyMap<string, number>>(EMPTY);

export function SeriesRatingProvider({
  ratings,
  children,
}: {
  ratings: ReadonlyMap<string, number>;
  children: ReactNode;
}) {
  return <SeriesRatingContext.Provider value={ratings}>{children}</SeriesRatingContext.Provider>;
}

export function useSeriesRatingMap(): ReadonlyMap<string, number> {
  return useContext(SeriesRatingContext);
}

/**
 * La portée des notes d'une liste de cartes : les séries dont la note manque
 * à ses épisodes (et aux tuiles de lot « +N »), demandées EN UNE requête,
 * puis données à ses cartes. Sans elle, un épisode de « Reprendre » ou de
 * « Prochains épisodes » n'affichait aucune note — celle de SA série, que
 * l'affiche montre. Une liste sans épisode ne demande rien.
 */
export function SeriesRatingScope({ items, children }: { items: readonly MediaItem[]; children: ReactNode }) {
  const missing = useMemo(() => missingSeriesRatingIds(items), [items]);
  const ratings = useSeriesRatings(missing);
  return <SeriesRatingProvider ratings={ratings}>{children}</SeriesRatingProvider>;
}
