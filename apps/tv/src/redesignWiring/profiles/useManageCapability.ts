import { useServerCapabilities } from "@tentacle-tv/api-client";
import type { ManageCapability } from "@tentacle-tv/tv-core";
import { useGuestPhotoCapable } from "../avatars/useGuestPhotoCapable";
import { useFamilyCapability } from "./useFamilyCapability";

/**
 * Ce que la fiche d'un profil peut proposer : ce que le serveur sait faire
 * (ses capacités — jamais un numéro de version). Un geste absent n'est pas
 * proposé (tv-core `familyManageSheet`). La photo d'un invité suit la porte
 * de la galerie (`useGuestPhotoCapable`, T4).
 */
export function useManageCapability(enabled: boolean): ManageCapability {
  const family = useFamilyCapability(enabled);
  const { capabilities } = useServerCapabilities();
  return {
    guestRequests: family?.guestRequests === true,
    guestPhotos: useGuestPhotoCapable(),
    roles: capabilities.has("family.roles"),
    guestParental: capabilities.has("family.parentalControls"),
    memberParental: capabilities.has("family.memberParental"),
  };
}
