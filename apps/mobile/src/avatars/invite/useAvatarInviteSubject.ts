import { useServerCapability, useUserId } from "@tentacle-tv/api-client";
import { avatarInviteSubject, type AvatarInviteSubject } from "@tentacle-tv/shared";
import { useAccountHasPhoto } from "@/auth/useAccountHasPhoto";
import { useActiveProfile } from "@/family/profiles/profileSessionState";
import { usePickerListing } from "@/family/profiles/usePickerListing";

/**
 * Le sujet de l'invitation aux avatars et de l'étape « Votre photo » (règle
 * partagée `avatarInviteSubject`) : le compte en session personnelle, le
 * profil en session de profil — sa photo dite par le serveur, jamais par
 * `/Users/Me`, que le jeton d'un profil ne peut pas lire.
 */
export function useAvatarInviteSubject(): AvatarInviteSubject {
  const userId = useUserId();
  const accountHasPhoto = useAccountHasPhoto();
  const held = useActiveProfile();
  const listing = usePickerListing();
  const devicePhoto = useServerCapability("avatars.devicePhoto");
  return avatarInviteSubject({
    accountId: userId,
    accountHasPhoto,
    profile: held ? { id: held.id, imageTag: held.imageTag } : null,
    listed: listing.data?.profiles,
    devicePhoto,
  });
}
