/**
 * Octave — les adresses du mode (liens profonds stables), les MÊMES sur le web,
 * le bureau et le mobile (expo-router reprend ces chemins tels quels). Un album
 * ou un artiste se désigne par son identifiant Jellyfin, ou par sa clé
 * `ext:<pluginId>:<id>` hors bibliothèque. Les adresses traversent le stockage
 * (page gardée au lancement) : elles ne se renomment jamais.
 */

export const OCTAVE_BASE_PATH = "/octave";

const enc = encodeURIComponent;

export const octavePaths = {
  home: OCTAVE_BASE_PATH,
  search: `${OCTAVE_BASE_PATH}/search`,
  library: `${OCTAVE_BASE_PATH}/library`,
  liked: `${OCTAVE_BASE_PATH}/liked`,
  playlists: `${OCTAVE_BASE_PATH}/playlists`,
  /** L'import d'un lien de partage d'un autre Tentacle (`?share=<lien>`), où mène la page du lien (serveur : `OCTAVE_IMPORT_PATH`). */
  import: `${OCTAVE_BASE_PATH}/import`,
  /** La musique gardée sur cet appareil (bureau, `offline/DeviceView.tsx`). */
  device: `${OCTAVE_BASE_PATH}/device`,
  /** Les réglages d'Octave, DANS Octave (apparence, démarrage). */
  settings: `${OCTAVE_BASE_PATH}/settings`,
  /** « Gérer les profils », DANS Octave : la page Famille de Tentacle, en miroir. */
  profiles: `${OCTAVE_BASE_PATH}/profiles`,
  /** Le hub « Compte » (mobile : ouvert par l'avatar en tête des pages) — profil, réglages, apparence, hors ligne. */
  account: `${OCTAVE_BASE_PATH}/account`,
  playlist: (id: string) => `${OCTAVE_BASE_PATH}/playlist/${enc(id)}`,
  /** Une playlist HORS bibliothèque (celle d'une extension), par sa clé `ext:<pluginId>:<id>`. */
  externalPlaylist: (key: string) => `${OCTAVE_BASE_PATH}/mix/${enc(key)}`,
  /** La playlist d'une AMBIANCE de l'extension, par sa clé stable. */
  mood: (id: string) => `${OCTAVE_BASE_PATH}/mood/${enc(id)}`,
  /** Un MIX de l'accueil, consultable comme un album (`pages/homeMix.ts`), par son identifiant du jour. */
  homeMix: (id: string) => `${OCTAVE_BASE_PATH}/home-mix/${enc(id)}`,
  album: (idOrKey: string) => `${OCTAVE_BASE_PATH}/album/${enc(idOrKey)}`,
  artist: (idOrKey: string) => `${OCTAVE_BASE_PATH}/artist/${enc(idOrKey)}`,
};

/** Le lien d'un album/artiste : Jellyfin d'abord, sinon la clé externe ; `null` s'il n'y a rien où aller. */
export function entityTarget(entity: { jellyfinId: string | null; key?: string; external?: { pluginId: string; id: string } | null }): string | null {
  if (entity.jellyfinId) return entity.jellyfinId;
  if (entity.external) return `ext:${entity.external.pluginId}:${entity.external.id}`;
  return null;
}
