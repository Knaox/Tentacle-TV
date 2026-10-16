import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { PhotoSetupRedesign } from "../redesignWiring/photoSetup/PhotoSetupRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "PhotoSetup">;

/** La photo du profil (Apple TV et Android TV) : la dernière fenêtre du premier passage, après la barre. */
export function PhotoSetupScreen(props: Props) {
  return <PhotoSetupRedesign {...props} />;
}
