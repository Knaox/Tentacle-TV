import type { NavigationProp } from "@react-navigation/native";
import type { ManageRowModel } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";

/**
 * Les pages d'AUTRES chantiers que la fiche d'un profil ouvre (lot TV du
 * 16/10) : la galerie des personnages pour la photo d'un invité (T4), le
 * contrôle parental d'un invité ou d'un membre mineur (T2). La fiche ne
 * propose le geste que si la pile déclare la page (`routeDeclared`) : avant
 * leur arrivée, rien ne paraît, rien ne casse.
 *
 * ⚠️ Noms et paramètres à tenir d'accord avec leurs chantiers.
 */
export const GUEST_PHOTO_ROUTE = "AvatarGallery";
export const PARENTAL_ROUTE = "FamilyParental";

type AnyNavigation = NavigationProp<RootStackParamList>;
type LooseNavigate = (name: string, params?: object) => void;

/** La pile déclare-t-elle cette page ? */
export function routeDeclared(navigation: AnyNavigation, name: string): boolean {
  return navigation.getState()?.routeNames?.includes(name as keyof RootStackParamList) ?? false;
}

/** La galerie, pour la photo de CET invité (sa cible : `guest`). */
export function openGuestPhoto(navigation: AnyNavigation, row: ManageRowModel): void {
  (navigation.navigate as unknown as LooseNavigate)(GUEST_PHOTO_ROUTE, {
    target: { kind: "guest", userId: row.userId, name: row.name, color: row.color },
  });
}

/** Le contrôle parental de cet invité ou de ce membre mineur. */
export function openParental(navigation: AnyNavigation, row: ManageRowModel): void {
  (navigation.navigate as unknown as LooseNavigate)(PARENTAL_ROUTE, {
    userId: row.userId,
    kind: row.kind === "guest" ? "guest" : "member",
    name: row.name,
  });
}
