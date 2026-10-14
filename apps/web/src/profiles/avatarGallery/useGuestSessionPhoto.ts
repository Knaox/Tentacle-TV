import { useMemo } from "react";
import { useServerCapability } from "@tentacle-tv/api-client";
import { useActiveProfile } from "../../auth/profileSession";
import type { AvatarTarget } from "./useAvatarTarget";

/**
 * Pendant la session d'un INVITÉ sur le bureau : la cible de la galerie pour sa
 * photo, si l'appareil peut l'habiller — serveur qui le sait faire
 * (`family.guestPhotos`) et session personnelle qui gère cet invité
 * (`photoEditable`, dit par « Qui regarde ? »). Sinon null : ni bouton, ni
 * invitation.
 */
export function useGuestSessionPhoto(): AvatarTarget | null {
  const profile = useActiveProfile();
  const capable = useServerCapability("family.guestPhotos");
  return useMemo<AvatarTarget | null>(
    () =>
      profile && profile.kind === "guest" && profile.photoEditable === true && capable
        ? { kind: "guest", userId: profile.id, name: profile.name, imageTag: profile.imageTag, through: "personal" }
        : null,
    [profile, capable],
  );
}
