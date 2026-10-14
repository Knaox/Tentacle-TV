import { useCallback, useRef, useState } from "react";
import { useSetFamilyGuestPhoto } from "@tentacle-tv/api-client";
import { guestPhotoBody, type GalleryTarget } from "./guestPhoto";
import type { PhotoPayload } from "./photoChain";
import { useProfilePhotoUpload, type PhotoUploadResult } from "./useProfilePhotoUpload";

/** `tooLarge` : une photo importée trop lourde pour la photo d'un invité. */
export type GalleryUploadResult = PhotoUploadResult | "tooLarge";

/**
 * L'envoi de la galerie, selon sa cible : la photo Jellyfin du compte
 * (`useProfilePhotoUpload`), ou celle d'un invité, posée par le serveur
 * (`setGuestPhoto`) — la Famille se relit ensuite (le crochet invalide
 * `["family"]`). Un envoi à la fois.
 */
export function useGalleryUpload(target: GalleryTarget) {
  const { upload: uploadAccount, uploading: accountUploading } = useProfilePhotoUpload();
  // `mutateAsync` est stable ; l'objet de la mutation, lui, change à chaque état.
  const { mutateAsync: setGuestPhoto } = useSetFamilyGuestPhoto();
  const [guestUploading, setGuestUploading] = useState(false);
  const inFlight = useRef(false);

  const upload = useCallback(async (photo: () => Promise<PhotoPayload>): Promise<GalleryUploadResult> => {
    if (target.kind === "account") return uploadAccount(photo);
    if (inFlight.current) return "busy";
    inFlight.current = true;
    setGuestUploading(true);
    try {
      const body = guestPhotoBody(await photo());
      if (body === "tooLarge") return "tooLarge";
      if (body === null) return "failed";
      await setGuestPhoto({ userId: target.userId, photo: body });
      return "sent";
    } catch {
      return "failed";
    } finally {
      inFlight.current = false;
      setGuestUploading(false);
    }
  }, [target, uploadAccount, setGuestPhoto]);

  return { upload, uploading: target.kind === "account" ? accountUploading : guestUploading };
}
