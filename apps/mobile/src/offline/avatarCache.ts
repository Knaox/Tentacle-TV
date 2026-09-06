/**
 * Cache local de la photo de profil, PAR compte.
 *
 * Hors ligne, l'image de l'avatar pointe vers Jellyfin et échoue : l'utilisateur
 * retombe sur son initiale dans une application pourtant utilisable. Une photo
 * de profil est un repère d'identité ; la perdre au premier tunnel donne
 * l'impression d'être déconnecté.
 *
 * Emplacement : `Documents/offline-avatars/<stem>.jpg`, HORS de la racine des
 * titres — « tout retirer » ne doit pas effacer un visage. Aucun secret.
 */

import { Directory, File, Paths } from "expo-file-system";
import type { StorageAdapter } from "@tentacle-tv/api-client";

const DIR_NAME = "offline-avatars";
/** Au-delà, ce n'est pas la photo qu'on croit (l'envoi redimensionne à 512 px). */
const MAX_BYTES = 512 * 1024;

/** Nom de fichier sûr : caractères alphanumériques seulement, jamais vide. */
function safeStem(userId: string): string | null {
  const stem = userId.replace(/[^A-Za-z0-9]/g, "");
  return stem === "" ? null : stem;
}

function avatarFile(userId: string): File | null {
  const stem = safeStem(userId);
  if (stem === null) return null;
  const dir = new Directory(Paths.document, DIR_NAME);
  dir.create({ intermediates: true, idempotent: true });
  return new File(dir, `${stem}.jpg`);
}

/** URI `file://` réutilisable directement en `source`, ou `null`. */
export function cachedAvatarUri(userId: string): string | null {
  try {
    const file = avatarFile(userId);
    return file !== null && file.exists && file.size > 0 ? file.uri : null;
  } catch {
    return null;
  }
}

/** Récupère la photo servie par Jellyfin et la dépose dans le cache (best-effort). */
export async function cacheAvatarFrom(userId: string, url: string, token: string): Promise<void> {
  try {
    const target = avatarFile(userId);
    if (target === null) return;
    const res = await fetch(url, { headers: { "X-Emby-Token": token } });
    if (!res.ok) return;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return;
    // Écriture par fichier temporaire puis renommage : une coupure en cours
    // d'écriture laisserait sinon un JPEG tronqué.
    const tmp = new File(target.parentDirectory, `${target.name}.part`);
    if (!tmp.exists) tmp.create({ overwrite: true });
    tmp.write(bytes);
    if (target.exists) target.delete();
    tmp.move(target);
  } catch {
    // Hors ligne, l'appel échoue et la copie précédente reste.
  }
}

/** Retire la photo d'un compte (déconnexion définitive, changement de serveur). */
export function forgetAvatar(userId: string): void {
  try {
    const file = avatarFile(userId);
    if (file !== null && file.exists) file.delete();
  } catch {
    // Rien à retirer.
  }
}

/**
 * Aligne la copie locale sur le profil stocké (`tentacle_user`) : une photo
 * présente est recopiée sous son étiquette du moment, une photo retirée est
 * oubliée. Appelé à chaque passage en ligne, best-effort.
 */
export function syncAvatarCache(userId: string, serverUrl: string, token: string, storage: StorageAdapter): void {
  let tag: string | null;
  try {
    const user = JSON.parse(storage.getItem("tentacle_user") ?? "null") as { PrimaryImageTag?: string | null } | null;
    tag = user?.PrimaryImageTag ?? null;
  } catch {
    return;
  }
  if (tag === null) {
    forgetAvatar(userId);
    return;
  }
  const url = `${serverUrl}/api/jellyfin/Users/${encodeURIComponent(userId)}/Images/Primary?tag=${encodeURIComponent(tag)}&quality=90&maxWidth=200`;
  void cacheAvatarFrom(userId, url, token);
}
