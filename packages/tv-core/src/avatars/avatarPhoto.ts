/**
 * Les IMAGES de la troupe pour la TV, et ce qui part chez Jellyfin.
 *
 * Le serveur Tentacle sert la troupe sous `/avatars/<id>.webp` (512 px) et
 * `/avatars/thumbs/<id>.webp` (192 px), interface web coupée comprise — et
 * tout serveur qui déclare `avatars.devicePhoto` les sert. Choisir un
 * personnage ENVOIE son image entière comme photo Jellyfin du sujet,
 * exactement comme une photo importée : l'API attend le corps ENCODÉ en
 * base64, avec son type (`image/webp`, que Jellyfin accepte — vérifié en
 * 10.11 pour le mobile).
 *
 * Module pur : l'adresse se calcule, la donnée lue arrive en argument.
 */

export type AvatarImageSize = "thumb" | "full";

/** L'adresse d'une image de la troupe ; null sans serveur ou pour un identifiant douteux. */
export function avatarImageUrl(serverUrl: string | null | undefined, id: string, size: AvatarImageSize): string | null {
  if (!serverUrl || !/^[a-z0-9]+$/.test(id)) return null;
  const base = serverUrl.replace(/\/+$/, "");
  return size === "thumb" ? `${base}/avatars/thumbs/${id}.webp` : `${base}/avatars/${id}.webp`;
}

/** Une image prête à partir : le corps base64 et son type. */
export interface AvatarPhotoPayload {
  base64: string;
  mime: string;
}

/**
 * L'image lue comme `data:` (le `FileReader` de React Native, faute de
 * `Buffer`) — une IMAGE non vide : un serveur qui n'a pas le fichier peut
 * répondre 200 avec la page du client web. null sinon.
 *
 * Le type est celui que la RÉPONSE déclare (`Content-Type`) quand on l'a :
 * sur Android, le blob d'une réponse `fetch` n'a pas de type
 * (`BlobModule.toResponseData` ne le pose pas, iOS si), et `FileReader` le
 * dit alors `application/octet-stream` — la photo était refusée à tout coup.
 * Sans en-tête, le type du `data:`.
 */
export function avatarPhotoFromDataUrl(dataUrl: string, declaredType?: string | null): AvatarPhotoPayload | null {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  const mime = (mediaType(declaredType) ?? mediaType(match[1]) ?? "").toLowerCase();
  const base64 = (match[2] ?? "").replace(/\s+/g, "");
  if (!mime.startsWith("image/") || base64.length === 0) return null;
  return { base64, mime };
}

/** Le type d'un en-tête, sans ses paramètres (`image/webp; charset=…`) ; null s'il n'y en a pas. */
function mediaType(value: string | null | undefined): string | null {
  const type = (value ?? "").split(";")[0]?.trim() ?? "";
  return type.length > 0 ? type : null;
}

/** L'adresse, par le proxy du serveur, où la photo du compte se pose (`POST`) ou se lit. */
export function accountPhotoPath(jellyfinBase: string, userId: string): string {
  return `${jellyfinBase.replace(/\/+$/, "")}/Users/${encodeURIComponent(userId)}/Images/Primary`;
}
