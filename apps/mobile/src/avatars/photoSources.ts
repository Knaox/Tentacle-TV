import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { AVATAR_IMAGES } from "./avatarAssets.generated";
import { characterPhotoFrom, type PhotoPayload } from "./photoChain";

export type { PhotoPayload } from "./photoChain";

/**
 * La photothèque, recadrage carré : la photo choisie, `null` si l'on renonce,
 * `"denied"` sans la permission (l'appelant dit où l'accorder).
 */
export async function pickLibraryPhoto(quality = 0.85): Promise<PhotoPayload | null | "denied"> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return "denied";
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    aspect: [1, 1],
    quality,
    base64: true,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset?.base64) return null;
  return { base64: asset.base64, mime: asset.mimeType ?? "image/jpeg" };
}

/**
 * L'image entière d'un personnage (512 px) : celle du paquet de l'app, sinon
 * celle du serveur Tentacle (`photoChain`). Elle part en WebP, que Jellyfin
 * accepte (tout `image/*`, extension tirée du type —
 * `ImageController.TryGetImageExtensionFromContentType`, 10.11 ; vérifié : 204,
 * image relue intacte) et convertit à la demande pour les clients qui ne le
 * lisent pas. Le serveur Tentacle relaie tout `image/*` tel quel.
 */
export function characterPhoto(id: string, serverUrl: string): Promise<PhotoPayload> {
  return characterPhotoFrom(id, serverUrl, { bundled: bundledCharacterPhoto, fetcher: (url) => fetch(url) });
}

/**
 * L'image embarquée. Android en release : elle n'est qu'un NOM de ressource
 * (`assets_avatars_huit`), qu'expo-asset tient pour « déjà là » — sans fichier
 * à lire. Une copie sans ce raccourci la fait recopier dans le cache.
 */
async function bundledCharacterPhoto(id: string): Promise<PhotoPayload> {
  const source = AVATAR_IMAGES[id];
  if (source === undefined) throw new Error(`avatar inconnu : ${id}`);
  const bundled = Asset.fromModule(source);
  const asset = bundled.localUri?.includes(":")
    ? bundled
    : new Asset({ name: bundled.name, type: bundled.type, hash: bundled.hash, uri: bundled.uri });
  if (!asset.localUri?.includes(":")) await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  return { base64: await new File(uri).base64(), mime: "image/webp" };
}
