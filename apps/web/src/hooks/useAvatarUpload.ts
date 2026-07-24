import { useCallback, useEffect, useState } from "react";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { cacheAvatarFrom, getCachedAvatar } from "../offline/avatarCache";
import { useConnectivity } from "../offline/useConnectivity";

/**
 * Avatar Jellyfin de l'utilisateur courant : URL (cache-bustée après upload)
 * + envoi d'une nouvelle photo (POST Users/{id}/Images/Primary en base64 —
 * l'avatar change donc aussi dans les autres clients Jellyfin).
 * Partagé par ProfileHero (page Profil) et UserAvatarMenu (dropdown desktop).
 *
 * Une COPIE LOCALE est entretenue sur desktop (`avatarCache`, fichier dans
 * `app_data_dir`). Sans elle, l'`<img>` pointait vers Jellyfin et échouait dès
 * la connexion perdue : l'utilisateur retombait sur l'initiale de son nom, dans
 * une app qui reste pourtant utilisable sur son contenu téléchargé. La copie est
 * rafraîchie à chaque passage en ligne, donc elle suit les changements de photo
 * faits depuis n'importe quel client.
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
  const connectivity = useConnectivity();
  const [uploading, setUploading] = useState(false);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    versionListeners.add(listener);
    return () => { versionListeners.delete(listener); };
  }, []);

  const remoteUrl = userId
    ? `${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=160&quality=90${avatarVersion ? `&v=${avatarVersion}` : ""}`
    : null;

  // Copie locale relue au montage : elle doit être prête AVANT une éventuelle
  // coupure, pas récupérée au moment où le réseau tombe.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void getCachedAvatar(userId).then((url) => { if (alive) setCachedUrl(url); });
    return () => { alive = false; };
  }, [userId]);

  // Rafraîchissement de la copie à chaque passage en ligne. `avatarVersion` est
  // dans les dépendances : un envoi de photo doit remplacer la copie locale, pas
  // laisser l'ancienne s'afficher au prochain démarrage hors ligne.
  useEffect(() => {
    if (!userId || !remoteUrl || connectivity.state !== "online") return;
    void cacheAvatarFrom(userId, remoteUrl).then(() => getCachedAvatar(userId)).then(setCachedUrl);
  }, [userId, remoteUrl, connectivity.state]);

  // Hors ligne, on ne DEMANDE même pas l'URL réseau : la requête échouerait,
  // l'`<img>` déclencherait son `onError` et le composant basculerait sur son
  // initiale le temps du repli. Autant servir la copie locale d'emblée.
  const avatarUrl = connectivity.state === "online" ? remoteUrl : (cachedUrl ?? remoteUrl);

  /**
   * Repli en CHAÎNE : URL du moment, puis copie locale, puis rien (les
   * composants affichent alors l'initiale).
   *
   * Un simple booléen « l'image a échoué » ne suffit pas : il faut se souvenir
   * de QUELLE source a échoué, sinon le repli sur la copie locale ramène la
   * première dans la liste au rendu suivant, et les deux se relancent en boucle.
   */
  const [dead, setDead] = useState<ReadonlySet<string>>(() => new Set());
  const avatarSrc =
    [avatarUrl, cachedUrl].find((url): url is string => !!url && !dead.has(url)) ?? null;
  const onAvatarError = useCallback(() => {
    if (avatarSrc) setDead((prev) => new Set(prev).add(avatarSrc));
  }, [avatarSrc]);

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

  return { avatarUrl, avatarSrc, onAvatarError, avatarVersion, uploading, upload, userId };
}
