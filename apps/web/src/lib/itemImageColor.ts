import type { MediaItem } from "@tentacle-tv/shared";
import { imageColorOf, type ImageBlurHashes } from "./blurhashColor";

/**
 * La couleur d'attente d'une image d'un TITRE Jellyfin (docs/REFONTE-UI.md, « Une image qui ne
 * clignote pas ») : Jellyfin joint `ImageBlurHashes` à ses titres, mais le type partagé
 * `MediaItem` — lu aussi par le mobile et les TV — ne le déclare pas. Une seule conversion,
 * ici, plutôt qu'une par écran.
 *
 * `null` quand le serveur n'a rien donné : l'appelant garde l'encre de carte.
 */
export function itemImageColor(item: MediaItem | null | undefined, type: string, tag?: string | null): string | null {
  return imageColorOf((item as { ImageBlurHashes?: ImageBlurHashes } | null | undefined)?.ImageBlurHashes, type, tag);
}
