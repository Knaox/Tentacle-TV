import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { ProfilePinRedesign } from "../redesignWiring/profiles/ProfilePinRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "ProfilePin">;

/** SON code PIN (Famille) — Apple TV seulement, depuis Réglages › Compte d'un profil ouvert. */
export function ProfilePinScreen(props: Props) {
  return <ProfilePinRedesign {...props} />;
}
