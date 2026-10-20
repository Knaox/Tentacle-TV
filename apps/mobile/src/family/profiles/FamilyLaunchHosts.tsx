import { ProfileLaunchGate } from "./ProfileLaunchGate";

/**
 * Les hôtes du lancement de la Famille, montés une fois à la racine : « Qui
 * regarde ? » (`ProfileLaunchGate`), puis le premier lancement du profil
 * (`FirstRunHost`) — l'ordre de la TV : profil et PIN, puis l'accueil, puis la photo.
 */
export function FamilyLaunchHosts() {
  return <ProfileLaunchGate />;
}
