import {
  FAMILY_GUEST_PHOTO_MAX_BASE64,
  FAMILY_GUEST_PHOTO_TYPES,
  type FamilyGuestPhotoType,
  type SetGuestPhotoBody,
} from "@tentacle-tv/shared";
import type { PhotoPayload } from "./photoChain";

/**
 * À qui la galerie donne une photo : le compte de la session (sa photo
 * Jellyfin), ou un invité de la Famille que ce compte gère — le SERVEUR
 * l'habille (`setGuestPhoto`, capacité `family.guestPhotos`, mêmes droits que
 * son PIN). Module PUR : testé sous vitest.
 */
export type GalleryTarget =
  | { kind: "account" }
  | { kind: "guest"; userId: string; name: string };

export const ACCOUNT_TARGET: GalleryTarget = { kind: "account" };

const isGuestPhotoType = (mime: string): mime is FamilyGuestPhotoType =>
  (FAMILY_GUEST_PHOTO_TYPES as readonly string[]).includes(mime);

/**
 * Le corps de `setGuestPhoto` pour cette image ; `tooLarge` au-delà de ce que
 * le serveur accepte (une photo importée, que le mobile ne sait pas réduire),
 * `null` pour un format qu'il ne relaie pas.
 */
export function guestPhotoBody(photo: PhotoPayload): SetGuestPhotoBody | "tooLarge" | null {
  const mime = photo.mime.toLowerCase();
  if (!isGuestPhotoType(mime)) return null;
  if (photo.base64.length > FAMILY_GUEST_PHOTO_MAX_BASE64) return "tooLarge";
  return { image: photo.base64, type: mime };
}
