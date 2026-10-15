import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setFamilyGuestPhoto, useJellyfinClient, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { FAMILY_GUEST_PHOTO_TYPES, type FamilyGuestPhotoType } from "@tentacle-tv/shared";
import {
  accountPhotoPath,
  avatarImageUrl,
  avatarPhotoFromDataUrl,
  type AvatarGalleryTarget,
  type AvatarPhotoPayload,
} from "@tentacle-tv/tv-core";
import { bumpOwnPhotoVersion } from "../../lib/ownPhotoVersion";
import { ownPhotoQueryKey } from "./ownPhoto";

/** Le plus long qu'on attende l'image et son envoi : au-delà, l'échec se dit. */
const SEND_TIMEOUT_MS = 20_000;

/**
 * L'ENVOI d'un personnage comme photo (Apple TV, Android TV), selon la cible :
 *
 * - `self` : la photo Jellyfin du sujet de la session, par le proxy
 *   (`POST /Users/{soi}/Images/Primary`, capacité `avatars.devicePhoto`) —
 *   exactement comme une photo importée, elle suit le compte sur tous ses
 *   clients. Puis sa sonde se relit, son portrait change d'adresse, et
 *   « Qui regarde ? » se relit (`["tv-profiles"]`) ;
 * - `guest` : un invité de la Famille, que le SERVEUR habille (`setGuestPhoto`,
 *   `family.guestPhotos`) — c'est lui qui dit si cette session le peut (au
 *   16/10, une session personnelle seulement : depuis une TV, il refuse, et
 *   l'échec se dit ; la règle d'un parent sur la TV est en cours de décision).
 *
 * L'image entière vient du serveur Tentacle (`/avatars/<id>.webp`). Un envoi
 * à la fois. Rend vrai si la photo est posée.
 */
export function useAvatarPhotoUpload(target: AvatarGalleryTarget): (id: string) => Promise<boolean> {
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const inFlight = useRef(false);

  return useCallback(
    async (id: string) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      try {
        const photo = await withTimeout(fetchAvatarPhoto(storage.getItem("tentacle_server_url"), id));
        if (target.kind === "guest") {
          const type = FAMILY_GUEST_PHOTO_TYPES.find((accepted): accepted is FamilyGuestPhotoType => accepted === photo.mime);
          if (!type) return false;
          await withTimeout(setFamilyGuestPhoto({ userId: target.userId, photo: { image: photo.base64, type } }));
        } else {
          if (!userId) return false;
          const response = await withTimeout(
            fetch(accountPhotoPath(client.getBaseUrl(), userId), {
              method: "POST",
              headers: { Authorization: client.getAuthHeader(), "Content-Type": photo.mime },
              body: photo.base64,
            }),
          );
          if (!response.ok) return false;
          bumpOwnPhotoVersion(userId);
          void queryClient.invalidateQueries({ queryKey: ownPhotoQueryKey(userId) });
        }
        void queryClient.invalidateQueries({ queryKey: ["tv-profiles"] });
        return true;
      } catch {
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [client, storage, userId, queryClient, target],
  );
}

/** L'image entière d'un personnage, lue chez le serveur Tentacle. */
async function fetchAvatarPhoto(serverUrl: string | null, id: string): Promise<AvatarPhotoPayload> {
  const url = avatarImageUrl(serverUrl, id, "full");
  if (!url) throw new Error("avatar : pas de serveur");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`avatar ${response.status}`);
  const photo = avatarPhotoFromDataUrl(await readAsDataUrl(await response.blob()));
  if (!photo) throw new Error("avatar : pas une image");
  return photo;
}

/** Le `FileReader` de React Native : le seul chemin vers le base64 d'un corps binaire (ni `Buffer`, ni `btoa` fiable). */
function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("avatar : lecture")));
    reader.onerror = () => reject(new Error("avatar : lecture"));
    reader.readAsDataURL(blob);
  });
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("avatar : délai")), SEND_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
