import { createContext, useContext } from "react";
import type { ReactNode } from "react";

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
