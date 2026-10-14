import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { AVATAR_IMAGES } from "./avatarAssets.generated";

/** Une image prête à partir : l'API Jellyfin attend le corps ENCODÉ base64, avec son type. */
export interface PhotoPayload {
  base64: string;
  mime: string;
}

/**
 * La photothèque, recadrage carré : la photo choisie, `null` si l'on renonce,
 * `"denied"` sans la permission (l'appelant dit où l'accorder).
 */
export async function pickLibraryPhoto(): Promise<PhotoPayload | null | "denied"> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return "denied";
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    base64: true,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset?.base64) return null;
  return { base64: asset.base64, mime: asset.mimeType ?? "image/jpeg" };
}

/**
 * L'image entière d'un personnage (512 px), lue dans le paquet de l'app : elle
 * part en WebP, que Jellyfin accepte (tout `image/*`, extension tirée du type —
 * `ImageController.TryGetImageExtensionFromContentType`, 10.11) et convertit à
 * la demande pour les clients qui ne le lisent pas. Aucun outil de l'app ne
 * réencode en JPEG, et le serveur Tentacle relaie tout `image/*` tel quel.
 *
 * Android en release : une image embarquée n'est qu'un NOM de ressource
 * (`assets_avatars_huit`), qu'expo-asset tient pour « déjà là » — sans fichier
 * à lire. Une copie sans ce raccourci la fait recopier dans le cache.
 */
export async function characterPhoto(id: string): Promise<PhotoPayload> {
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
