import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { ManageProfilesRedesign } from "../redesignWiring/profiles/ManageProfilesRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "ManageProfiles">;

/** « Gérer les profils » (Famille) — Apple TV seulement, profil du propriétaire. */
export function ManageProfilesScreen(props: Props) {
  return <ManageProfilesRedesign {...props} />;
}
