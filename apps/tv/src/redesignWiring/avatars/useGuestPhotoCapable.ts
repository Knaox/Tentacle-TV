import { useServerCapabilities } from "@tentacle-tv/api-client";

/**
 * Le serveur sait-il habiller un INVITÉ depuis la TV ? La SEULE porte de la
 * galerie pour un invité (à sa création, dans Gérer les profils) : la galerie
 * de la TV (`avatars.devicePhoto`) et la photo d'un invité posée par le
 * serveur (`family.guestPhotos`).
 *
 * ⚠️ Au 16/10, `setGuestPhoto` ne répond qu'à une session personnelle : depuis
 * une TV, l'envoi est refusé et la galerie le dit (« Réessayez, ou plus
 * tard »). Ouvrir la route aux gestionnaires de la TV est une décision de la
 * Famille ; le jour où elle vient avec sa capacité, elle s'ajoute ICI.
 */
export function useGuestPhotoCapable(): boolean {
  const { capabilities } = useServerCapabilities();
  return capabilities.has("avatars.devicePhoto") && capabilities.has("family.guestPhotos");
}
