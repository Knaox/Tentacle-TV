/**
 * Octave (mobile) — le VISAGE du profil en cours (`tentacle_user`, personnel ou de profil) : sa photo Jellyfin,
 * relue sous les yeux après un envoi (`pendingPhoto`), la copie locale hors ligne ou quand Jellyfin ne la rend
 * pas, sinon l'initiale sur la couleur du profil — les mêmes sources que l'avatar du profil de Tentacle.
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { profileColorStops } from "@tentacle-tv/shared";
import { profilePhotoUrl } from "@/auth/storedUser";
import { useStoredUser } from "@/auth/useStoredUser";
import { pendingPhotoSnapshot, photoTagFor, subscribePendingPhoto } from "@/avatars/pendingPhoto";
import { useCachedPhotoRepair } from "@/avatars/useCachedPhotoRepair";
import { useAccountFaceColor } from "@/family/profiles/useAccountFaceColor";
import { cachedAvatarUri } from "@/offline/avatarCache";
import { useOfflineMode } from "@/offline/useOfflineMode";

export interface ProfileFace {
  name: string;
  initial: string;
  /** L'image à montrer ; null : l'initiale. */
  uri: string | null;
  /** Les arrêts du dégradé de l'initiale (couleur du profil) ; null : le dégradé de la marque. */
  stops: readonly string[] | null;
  /** L'image n'a pas pu se charger (l'initiale ou la copie locale la remplace). */
  onError: () => void;
  /** À poser sur l'`<Image>` : la réparation d'une photo gardée tronquée (`useCachedPhotoRepair`). */
  imageKey: string;
  onLoad: () => void;
}

export function useProfileFace(): ProfileFace {
  const { storage } = useTentacleConfig();
  const user = useStoredUser();
  const offline = useOfflineMode();
  const faceColor = useAccountFaceColor();
  const [failed, setFailed] = useState<string | null>(null);
  useSyncExternalStore(subscribePendingPhoto, pendingPhotoSnapshot, pendingPhotoSnapshot);

  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const userId = user?.Id ?? null;
  const tag = photoTagFor(userId, user?.PrimaryImageTag ?? null);
  const photo = userId ? profilePhotoUrl(serverUrl, userId, tag) : null;
  const fallback = offline || (photo !== null && failed === photo);
  const cached = useMemo(() => (userId && fallback ? cachedAvatarUri(userId) : null), [userId, fallback]);
  const onError = useCallback(() => {
    if (!fallback) setFailed(photo);
  }, [fallback, photo]);

  const repair = useCachedPhotoRepair(fallback ? null : photo);

  const name = user?.Name ?? "";
  return {
    name,
    initial: name.charAt(0).toUpperCase(),
    uri: fallback ? cached : photo,
    stops: faceColor ? profileColorStops(faceColor) : null,
    onError,
    imageKey: repair.key,
    onLoad: repair.onLoad,
  };
}
