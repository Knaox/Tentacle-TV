import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { PinSetupRedesign } from "../redesignWiring/pinSetup/PinSetupRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "PinSetup">;

/**
 * Le code PIN conseillé (Apple TV et Android TV) : la première fenêtre du
 * premier passage dans un profil, avant la barre — une fois par profil et
 * par appareil.
 */
export function PinSetupScreen(props: Props) {
  return <PinSetupRedesign {...props} />;
}
