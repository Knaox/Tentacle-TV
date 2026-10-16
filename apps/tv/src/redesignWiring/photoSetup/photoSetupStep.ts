import { avatarOfferPending } from "../avatars/useAvatarOfferGate";

/**
 * L'étape « Photo du profil » du premier passage — la TROISIÈME fenêtre du
 * démarrage, après la barre (tv-core `nav/startupWindows`). La règle est
 * celle de la galerie des avatars (tv-core `avatars/avatarOffer`) : un sujet
 * sans photo — invité compris —, une fois par sujet et par appareil, face à
 * un serveur qui déclare `avatars.devicePhoto`. Lue ici sans attendre ; la
 * décision finale reste la porte (`useAvatarOfferGate`).
 */
export function photoSetupPending(): boolean {
  return avatarOfferPending();
}
