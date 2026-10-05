import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { TrailerRedesign } from "../redesignWiring/trailer/TrailerRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "Trailer">;

/** La bande-annonce, relayée par le serveur (la refonte, `redesignWiring/trailer`). */
export function TrailerScreen(props: Props) {
  return <TrailerRedesign {...props} />;
}
