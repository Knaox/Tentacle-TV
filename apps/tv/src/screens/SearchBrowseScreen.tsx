import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { BrowseRedesign } from "../redesignWiring/browse/BrowseRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "SearchBrowse">;

/**
 * La recherche approfondie : la filmographie d'une personne, un genre ou un
 * studio, dans la bibliothèque (`/api/search/person|genre|studio`) — la
 * refonte, `redesignWiring/browse`. Rien de ce qui n'est pas sur le serveur :
 * c'est une étagère, pas un catalogue.
 */
export function SearchBrowseScreen(props: Props) {
  return <BrowseRedesign {...props.route.params} />;
}
