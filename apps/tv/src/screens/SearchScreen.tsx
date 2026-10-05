import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { SearchRedesign } from "../redesignWiring/search/SearchRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

/**
 * La recherche des téléviseurs natifs, sur le moteur de Tentacle (la refonte,
 * `redesignWiring/search`) : les résultats dans l'ordre commun aux trois
 * téléviseurs (`tvSearchSections`, tv-core). La bibliothèque seule.
 */
export function SearchScreen(_props: Props) {
  return <SearchRedesign />;
}
