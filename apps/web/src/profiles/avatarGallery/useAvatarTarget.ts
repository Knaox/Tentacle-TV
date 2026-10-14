import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FAMILY_KEY, setFamilyGuestPhoto, setPickerGuestPhoto, useJellyfinClient } from "@tentacle-tv/api-client";
import { useAvatarUpload } from "../../hooks/useAvatarUpload";
import { getUserInfo } from "../../components/userMenu/menuItems";
import { accountToken, readActiveProfile, rememberActiveProfilePhoto } from "../../auth/profileSession";
import { getBackendBase } from "../../lib/backendBase";
import { imageToJpegBase64 } from "../../lib/imageToJpegBase64";

/**
 * À qui la galerie donne une photo :
 * - `account` : le compte de la session — sa photo Jellyfin (`useAvatarUpload`) ;
 * - `guest` : un invité de la Famille, que le SERVEUR habille (`setGuestPhoto`,
 *   capacité `family.guestPhotos`) — par la session courante (Réglages ›
 *   Famille), ou par la session PERSONNELLE de l'appareil pendant la session de
 *   profil de l'invité (`personal`), la seule à qui le serveur le permet.
 */
export type AvatarTarget =
  | { kind: "account" }
  | { kind: "guest"; userId: string; name: string; imageTag: string | null; through: "session" | "personal" };

export const ACCOUNT_TARGET: AvatarTarget = { kind: "account" };

export interface AvatarTargetState {
  /** Sa photo actuelle ; null : l'initiale. */
  currentSrc: string | null;
  initial: string;
  uploading: boolean;
  /** Envoie l'image ; vrai si elle est posée. */
  upload: (image: Blob) => Promise<boolean>;
}

function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? "?";
}

export function useAvatarTarget(target: AvatarTarget): AvatarTargetState {
  const account = useAvatarUpload();
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  const guest = target.kind === "guest" ? target : null;

  const uploadGuest = useCallback(async (image: Blob): Promise<boolean> => {
    if (!guest) return false;
    try {
      const { base64, mime } = await imageToJpegBase64(image);
      const photo = { image: base64, type: mime };
      let imageTag: string | null;
      if (guest.through === "personal") {
        const token = accountToken();
        if (!token) return false;
        ({ imageTag } = await setPickerGuestPhoto({ serverUrl: getBackendBase(), personalToken: token }, guest.userId, photo));
      } else {
        ({ imageTag } = await setFamilyGuestPhoto({ userId: guest.userId, photo }));
      }
      if (readActiveProfile()?.id === guest.userId) rememberActiveProfilePhoto(imageTag);
      void queryClient.invalidateQueries({ queryKey: FAMILY_KEY });
      return true;
    } catch {
      return false;
    }
  }, [guest, queryClient]);

  if (!guest) {
    return { currentSrc: account.avatarSrc, initial: getUserInfo().initial, uploading: account.uploading, upload: account.upload };
  }
  const tag = guest.imageTag ? `&tag=${encodeURIComponent(guest.imageTag)}` : "";
  return {
    currentSrc: guest.imageTag ? `${client.getBaseUrl()}/Users/${guest.userId}/Images/Primary?maxWidth=128&quality=90${tag}` : null,
    initial: initialOf(guest.name),
    uploading: false,
    upload: uploadGuest,
  };
}
