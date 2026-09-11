import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/**
 * Les notes de séries résolues pour une rangée, à la disposition de ses cartes.
 * Le jumeau des contextes du web et du mobile : la tuile d'un lot « +N » est
 * fabriquée côté client sans rien de la série, sa note vient donc d'une requête
 * groupée que la rangée déclenche.
 *
 * Carte vide GELÉE par défaut : les écrans qui ne fournissent rien ne paient
 * pas même une allocation par rendu.
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
