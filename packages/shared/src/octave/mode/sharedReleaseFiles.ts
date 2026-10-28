/**
 * Octave — des FICHIERS AUDIO partagés vers Tentacle TV (lot « sf ») : le natif ne fait que les nommer dans le lien
 * profond de l'import, `tentacle://octave/import?file=<uri>&fileName=<nom>&fileType=<type>` (répété par fichier) :
 * - Android : l'intent `SEND` / `SEND_MULTIPLE` d'un type `audio/*` (`ShareIntake.kt`), adresses `content://` ;
 * - iOS : « Ouvrir dans Tentacle TV » (types de documents audio de l'app) remet un fichier `file://` copié par le
 *   système dans la boîte de réception de l'app ; `+native-intent` le réécrit avec `releaseFileImportPath`.
 * Les noms des paramètres traversent le natif : jamais renommés.
 */

export const SHARED_FILE_PARAM = "file";
export const SHARED_FILE_NAME_PARAM = "fileName";
export const SHARED_FILE_TYPE_PARAM = "fileType";
/** Au plus, comme un lot d'import (`RELEASE_FILES_PER_JOB`). */
export const SHARED_FILES_MAX = 100;

export interface SharedAudioFile {
  uri: string;
  name: string;
  type: string;
}

const list = (value: string | string[] | undefined): string[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const SAFE_URI = /^(content|file):\/\//i;

/** Le nom d'un fichier tiré de son adresse (dernier segment, décodé). */
function nameOfUri(uri: string): string {
  const last = uri.split(/[?#]/)[0]?.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last) || "audio";
  } catch {
    return last || "audio";
  }
}

/** Les fichiers d'un lien profond d'import (paramètres répétés) ; seules les adresses `content://` et `file://`. */
export function sharedAudioFiles(params: Record<string, string | string[] | undefined>): SharedAudioFile[] {
  const uris = list(params[SHARED_FILE_PARAM]);
  const names = list(params[SHARED_FILE_NAME_PARAM]);
  const types = list(params[SHARED_FILE_TYPE_PARAM]);
  const out: SharedAudioFile[] = [];
  uris.forEach((uri, i) => {
    if (out.length >= SHARED_FILES_MAX || !SAFE_URI.test(uri)) return;
    out.push({ uri, name: names[i]?.trim() || nameOfUri(uri), type: types[i] ?? "" });
  });
  return out;
}

/**
 * iOS : l'adresse `file://` d'un document remis à l'app (« Ouvrir dans Tentacle TV ») → la route de l'import qui
 * le porte ; toute autre adresse : `null` (expo-router la traite comme d'habitude).
 */
export function releaseFileImportPath(url: string): string | null {
  if (!/^file:\/\//i.test(url)) return null;
  return `/octave/import?${SHARED_FILE_PARAM}=${encodeURIComponent(url)}&${SHARED_FILE_NAME_PARAM}=${encodeURIComponent(nameOfUri(url))}`;
}
