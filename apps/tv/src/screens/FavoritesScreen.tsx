import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { FavoritesRedesign } from "../redesignWiring/collection/CollectionRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

/**
 * Mes favoris en page parcourable (`Filters=IsFavorite`) — grille simple,
 * comme la LG : ni sélection multiple ni partage sur téléviseur.
 */
export function FavoritesScreen(_props: Props) {
  return <FavoritesRedesign />;
}
