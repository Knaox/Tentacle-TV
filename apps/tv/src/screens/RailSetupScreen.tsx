import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { RailSetupRedesign } from "../redesignWiring/railSetup/RailSetupRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "RailSetup">;

/**
 * La préconfiguration de la barre (Apple TV et Android TV) : avant l'accueil,
 * une fois par profil et par appareil — et l'étape du propriétaire depuis
 * Réglages › Navigation.
 */
export function RailSetupScreen(props: Props) {
  return <RailSetupRedesign {...props} />;
}
