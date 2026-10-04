import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { ProfilesRedesign } from "../redesignWiring/profiles/ProfilesRedesign";

type Props = NativeStackScreenProps<RootStackParamList, "Profiles">;

/**
 * « Qui regarde ? » (Famille) — Apple TV seulement : seule une TV passée aux
 * profils y arrive (`auth/profileEnrollment.ts`) ; Android TV garde son
 * jumelage d'avant et n'ouvre jamais cette route.
 */
export function ProfilesScreen(props: Props) {
  return <ProfilesRedesign {...props} />;
}
