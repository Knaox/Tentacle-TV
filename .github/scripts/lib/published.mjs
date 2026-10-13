// La version qu'une boutique sert DÉJÀ — le point de départ des notes
// cumulées (lib/changelog.mjs → `since`).
//
// updates/store-versions.json est tenu par le veilleur (store-watch.yml) d'après
// ce que chaque boutique sert réellement : c'est la source pour le Mac App
// Store, le Microsoft Store, Play (téléphone et TV) et Linux. iOS et Apple TV
// n'y sont pas : leurs scripts lisent App Store Connect (`liveVersion`).
//
// Une lecture impossible vaut null — et null veut dire « la seule version » :
// jamais des notes inventées.
import { readFileSync } from 'node:fs';
import { isVersion } from './versions.mjs';

/** Bloc de notes (le nom que lui donnent les workflows) → clé du manifeste. */
export const MANIFEST_BLOCKS = {
  mac: 'macAppStore',
  win: 'microsoftStore',
  'play-mobile': 'playMobile',
  'play-tv': 'playTv',
  linux: 'linux',
};

/** Le bloc du manifeste (`version`, `notes`), ou null. */
export function manifestEntry(block, file = 'updates/store-versions.json') {
  const key = MANIFEST_BLOCKS[block];
  if (!key) return null;
  try {
    const entry = JSON.parse(readFileSync(file, 'utf8'))[key];
    return entry && isVersion(entry.version) ? entry : null;
  } catch {
    return null;
  }
}

/** La version servie d'après le manifeste, ou null. */
export const manifestVersion = (block, file) => manifestEntry(block, file)?.version ?? null;
