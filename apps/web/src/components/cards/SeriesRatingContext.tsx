import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/**
 * Les notes de séries résolues pour une rangée, mises à la disposition de ses
 * cartes.
 *
 * Un contexte plutôt que des props, pour une raison précise : entre la rangée
 * qui charge les notes et l'affiche qui les pose, la chaîne est
 * `LibraryLatestRow → MediaRow → PosterCard → PosterTile`, et `MediaRow` est
 * SUBSTITUÉ au build sur webOS (`substitutionTable.ts`). Faire traverser une
 * prop obligerait à la déclarer aussi dans la version téléviseur, qui n'en a
 * que faire. Un contexte passe au travers sans rien demander à personne.
 *
 * Le défaut est une carte vide GELÉE au niveau module : les surfaces qui ne
 * fournissent rien — la plupart — ne paient pas même une allocation par rendu.
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

/** Les notes connues, ou une carte vide. Jamais `undefined` : rien à garder. */
export function useSeriesRatingMap(): ReadonlyMap<string, number> {
  return useContext(SeriesRatingContext);
}
