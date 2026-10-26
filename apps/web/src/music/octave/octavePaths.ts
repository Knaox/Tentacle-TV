/**
 * Octave — les adresses du mode (liens profonds stables). Un album ou un
 * artiste se désigne par son identifiant Jellyfin, ou par sa clé
 * `ext:<pluginId>:<id>` hors bibliothèque.
 */

import { OCTAVE_BASE_PATH } from "./mode/octaveMode";

const enc = encodeURIComponent;

export const octavePaths = {
  home: OCTAVE_BASE_PATH,
  search: `${OCTAVE_BASE_PATH}/search`,
  library: `${OCTAVE_BASE_PATH}/library`,
  liked: `${OCTAVE_BASE_PATH}/liked`,
  playlists: `${OCTAVE_BASE_PATH}/playlists`,
  /** La musique gardée sur cet appareil (bureau, `offline/DeviceView.tsx`). */
  device: `${OCTAVE_BASE_PATH}/device`,
  /** Les réglages d'Octave, DANS Octave (apparence, démarrage). */
  settings: `${OCTAVE_BASE_PATH}/settings`,
  playlist: (id: string) => `${OCTAVE_BASE_PATH}/playlist/${enc(id)}`,
  /** Une playlist HORS bibliothèque (celle d'une extension), par sa clé `ext:<pluginId>:<id>`. */
  externalPlaylist: (key: string) => `${OCTAVE_BASE_PATH}/mix/${enc(key)}`,
  album: (idOrKey: string) => `${OCTAVE_BASE_PATH}/album/${enc(idOrKey)}`,
  artist: (idOrKey: string) => `${OCTAVE_BASE_PATH}/artist/${enc(idOrKey)}`,
};

/** Le lien d'un album/artiste : Jellyfin d'abord, sinon la clé externe ; `null` s'il n'y a rien où aller. */
export function entityTarget(entity: { jellyfinId: string | null; key?: string; external?: { pluginId: string; id: string } | null }): string | null {
  if (entity.jellyfinId) return entity.jellyfinId;
  if (entity.external) return `ext:${entity.external.pluginId}:${entity.external.id}`;
  return null;
}
