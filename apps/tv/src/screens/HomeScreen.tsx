import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { HomeRedesign } from "../redesignWiring/home/HomeRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

/** L'accueil (la refonte, `redesignWiring/home`). */
export function HomeScreen(props: Props) {
  return <HomeRedesign {...props} />;
}
