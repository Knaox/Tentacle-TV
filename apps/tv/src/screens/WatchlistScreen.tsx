import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { WatchlistRedesign } from "../redesignWiring/collection/CollectionRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "Watchlist">;

/**
 * Ma liste en page parcourable — les mêmes éléments que la rangée de
 * l'accueil, en grille complète (`Filters=Likes`). Comme la LG : une grille
 * simple, SANS sélection multiple ni partage (boutons inatteignables au
 * D-pad, retirés du portage téléviseur).
 */
export function WatchlistScreen(_props: Props) {
  return <WatchlistRedesign />;
}
