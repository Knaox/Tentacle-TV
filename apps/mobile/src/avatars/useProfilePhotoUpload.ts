import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FAMILY_KEY, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { refreshStoredUser } from "@/auth/storedUser";
import { useStoredUser } from "@/auth/useStoredUser";
import { syncAvatarCache } from "@/offline/avatarCache";
import { rememberActiveProfilePhoto } from "@/family/profiles/profileSessionCore";
import { parseStoredUser, STORED_USER_KEY } from "@/auth/storedUser";
import { markPhotoPending } from "./pendingPhoto";
import type { PhotoPayload } from "./photoSources";

/** `sent` : l'image est partie ; `failed` : à dire ; `busy` : un envoi est déjà en cours, rien à dire. */
export type PhotoUploadResult = "sent" | "failed" | "busy";

/**
 * L'envoi de la photo du compte — photo importée ou personnage de la galerie,
 * par le MÊME chemin : `POST /Users/{id}/Images/Primary` (API Jellyfin, corps
 * en base64), donc la photo suit le compte sur tous ses clients. Puis la
 * relecture du profil, dont la nouvelle étiquette change l'URL (cache bust),
 * et la copie locale de la photo, qui suit.
 *
 * Un envoi à la fois, même entre deux rendus (deux touchers rapprochés).
 */
export function useProfilePhotoUpload() {
  const client = useJellyfinClient();
  const { storage } = useTentacleConfig();
  const user = useStoredUser();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const inFlight = useRef(false);

  const upload = useCallback(async (photo: () => Promise<PhotoPayload>): Promise<PhotoUploadResult> => {
    const serverUrl = storage.getItem("tentacle_server_url") ?? "";
    if (inFlight.current) return "busy";
    if (user === null || !serverUrl) return "failed";
    inFlight.current = true;
    setUploading(true);
    try {
      const payload = await photo();
      const response = await fetch(`${serverUrl}/api/jellyfin/Users/${encodeURIComponent(user.Id)}/Images/Primary`, {
        method: "POST",
        headers: { Authorization: client.getAuthHeader(), "Content-Type": payload.mime },
        body: payload.base64,
      });
      if (!response.ok) throw new Error(`${response.status}`);
      // Une relecture en échec ne fait pas de l'envoi réussi une erreur : la
      // photo est alors forcée localement jusqu'à la prochaine relecture.
      const photoChanged = await refreshStoredUser(storage, client);
      if (!photoChanged) markPhotoPending(user.Id, user.PrimaryImageTag ?? null);
      // Partout où le profil paraît : « Qui regarde ? », la Famille (relues), la marque d'une session de profil.
      rememberActiveProfilePhoto(storage, parseStoredUser(storage.getItem(STORED_USER_KEY))?.PrimaryImageTag ?? null);
      void queryClient.invalidateQueries({ queryKey: [...FAMILY_KEY] });
      const token = storage.getItem("tentacle_token");
      if (token) syncAvatarCache(user.Id, serverUrl, token, storage);
      return "sent";
    } catch {
      return "failed";
    } finally {
      inFlight.current = false;
      setUploading(false);
    }
  }, [client, storage, user, queryClient]);

  return { upload, uploading, canUpload: user !== null };
}
