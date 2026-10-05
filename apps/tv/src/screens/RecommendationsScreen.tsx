import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { ForYouRedesign } from "../redesignWiring/forYou/ForYouRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "Recommendations">;

/** « Pour vous » (la refonte, `redesignWiring/forYou`). */
export function RecommendationsScreen(props: Props) {
  return <ForYouRedesign {...props} />;
}
