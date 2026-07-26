/**
 * Accès JS au cache local de la photo de profil (fichier dans `app_data_dir`
 * côté Rust, desktop uniquement). Wrappers typés et SILENCIEUX hors Tauri, sur
 * le modèle de `offlineSession.ts` : un cache est un confort, jamais un chemin
 * critique — un échec ne doit rien casser.
 */

import { invoke } from "../desktop/bridge";
import { isTauri } from "../hooks/mpvRuntime";

/** Data URL réutilisable directement en `src`, ou null. */
export async function getCachedAvatar(userId: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const base64 = await invoke<string | null>("avatar_cache_get", { userId });
    return base64 ? `data:image/jpeg;base64,${base64}` : null;
  } catch {
    return null;
  }
}

/**
 * Télécharge la photo servie par Jellyfin et la dépose dans le cache local.
 *
 * Le téléchargement passe par `fetch` plutôt que par l'`<img>` déjà affichée :
 * on ne peut pas relire les pixels d'une image cross-origin sans salir un
 * canvas, et la réponse est de toute façon déjà en cache HTTP — cet appel ne
 * coûte donc rien de plus que la lecture d'un fichier local.
 */
export async function cacheAvatarFrom(userId: string, url: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const blob = await response.blob();
    if (!blob.size) return;
    const base64 = await blobToBase64(blob);
    await invoke("avatar_cache_put", { userId, base64Jpeg: base64 });
  } catch {
    /* Best-effort : hors ligne, l'appel échoue et la copie précédente reste. */
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    // `readAsDataURL` renvoie « data:<mime>;base64,<charge> » — le Rust n'attend
    // que la charge utile.
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}
