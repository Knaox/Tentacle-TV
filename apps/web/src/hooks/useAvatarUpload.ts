import { useCallback, useEffect, useState } from "react";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";

/**
 * Avatar Jellyfin de l'utilisateur courant : URL (cache-bustée après upload)
 * + envoi d'une nouvelle photo (POST Users/{id}/Images/Primary en base64 —
 * l'avatar change donc aussi dans les autres clients Jellyfin).
 * Partagé par ProfileHero (page Profil) et UserAvatarMenu (dropdown desktop).
 */

// Version module-level : bump après upload → tous les composants abonnés
// régénèrent l'URL de leur <img> (cache-bust), où qu'ils soient montés.
let avatarVersion = 0;
const versionListeners = new Set<() => void>();

/** Redimensionne l'image (≤ 512 px) et renvoie le base64 nu (format Jellyfin). */
async function fileToJellyfinBase64(file: File): Promise<{ base64: string; mime: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mime: "image/jpeg" };
}

export function useAvatarUpload() {
  const client = useJellyfinClient();
  const userId = useUserId();
  const [uploading, setUploading] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    versionListeners.add(listener);
    return () => { versionListeners.delete(listener); };
  }, []);

  const avatarUrl = userId
    ? `${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=160&quality=90${avatarVersion ? `&v=${avatarVersion}` : ""}`
    : null;

  /** Envoie la photo à Jellyfin. Renvoie true si l'upload a réussi. */
  const upload = useCallback(async (file: File): Promise<boolean> => {
    if (!userId) return false;
    setUploading(true);
    try {
      const { base64, mime } = await fileToJellyfinBase64(file);
      const token = client.getAccessToken();
      const res = await fetch(`${client.getBaseUrl()}/Users/${userId}/Images/Primary`, {
        method: "POST",
        headers: {
          "Content-Type": mime,
          ...(token && !client.useCredentials ? { "X-Emby-Token": token } : {}),
        },
        credentials: client.useCredentials ? "include" : undefined,
        body: base64,
      });
      if (!res.ok) throw new Error(`avatar upload ${res.status}`);
      avatarVersion = Date.now();
      for (const l of [...versionListeners]) l();
      return true;
    } catch {
      return false;
    } finally {
      setUploading(false);
    }
  }, [client, userId]);

  return { avatarUrl, avatarVersion, uploading, upload, userId };
}
