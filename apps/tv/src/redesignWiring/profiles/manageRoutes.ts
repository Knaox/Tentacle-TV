import type { NavigationProp } from "@react-navigation/native";
import type { ManageRowModel } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";

/**
 * Les pages d'AUTRES chantiers que la fiche d'un profil ouvre (lot TV du
 * 16/10) : la galerie des personnages pour la photo d'un invité (T4 :
 * `AvatarGallery`, `{ guest: { userId, name } }`, retour par `goBack` une fois
 * la photo posée, `["family"]` relu), le contrôle parental d'un invité ou
 * d'un membre mineur (T2 : `ParentalControls`, `{ userId }` — l'écran relit
 * le reste dans `GET /api/family`).
 */
type AnyNavigation = NavigationProp<RootStackParamList>;

/** La galerie, pour la photo de CET invité. */
export function openGuestPhoto(navigation: AnyNavigation, row: ManageRowModel): void {
  navigation.navigate("AvatarGallery", { guest: { userId: row.userId, name: row.name } });
}

/** Le contrôle parental de cet invité ou de ce membre mineur. */
export function openParental(navigation: AnyNavigation, row: ManageRowModel): void {
  navigation.navigate("ParentalControls", { userId: row.userId });
}
