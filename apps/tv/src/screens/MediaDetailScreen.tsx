import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { MediaDetailRedesign } from "../redesignWiring/detail/MediaDetailRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "MediaDetail">;

/** La fiche d'un titre (la refonte, `redesignWiring/detail`). */
export function MediaDetailScreen(props: Props) {
  return <MediaDetailRedesign {...props} />;
}
