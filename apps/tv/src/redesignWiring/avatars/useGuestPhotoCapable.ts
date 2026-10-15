import { useServerCapabilities } from "@tentacle-tv/api-client";

/**
 * Le serveur sait-il habiller un INVITÉ depuis la TV ? La SEULE porte de la
 * galerie pour un invité (Gérer les profils : à sa création, sur sa fiche) :
 * la galerie de la TV (`avatars.devicePhoto`), la photo d'un invité posée par
 * le serveur (`family.guestPhotos`), et la gestion de la Famille depuis une
 * session de profil (`family.profileManage` : `setGuestPhoto` répond alors à
 * `ownerProfile` / `memberProfile`, le service juge le rôle).
 */
export function useGuestPhotoCapable(): boolean {
  const { capabilities } = useServerCapabilities();
  return capabilities.has("avatars.devicePhoto") && capabilities.has("family.guestPhotos") && capabilities.has("family.profileManage");
}
