/**
 * Octave — une playlist HORS bibliothèque (clé `ext:<pluginId>:<id>`), servie par l'extension qui l'a donnée si
 * elle déclare la vue (`music.playlist`) ; sans elle, la clé ne mène nulle part (« introuvable »), sans rien
 * trahir. La clé de cache est celle que la lecture d'un geste emploie (`search/useTopPlayback.ts`) : une playlist
 * lue depuis sa carte s'ouvre ensuite aussitôt.
 */

import { useMusicExternalPlaylist } from "@tentacle-tv/api-client";
import { useOctaveProvider } from "../mode/useOctaveProvider";

/** Le crochet vit dans api-client (`useMusicExternalPlaylist`, le même pour le mobile). */
export function useExternalPlaylist(key: string) {
  return useMusicExternalPlaylist(useOctaveProvider(), key);
}
