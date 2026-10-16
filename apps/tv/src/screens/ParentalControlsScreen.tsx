import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { ParentalRedesign } from "../redesignWiring/parental/ParentalRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "ParentalControls">;

/**
 * Le contrôle parental simplifié d'un profil (Apple TV et Android TV) :
 * ouvert depuis « Gérer les profils », sur un invité ou un membre mineur.
 */
export function ParentalControlsScreen(props: Props) {
  return <ParentalRedesign {...props} />;
}
