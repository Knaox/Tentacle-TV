/**
 * Octave — le REGISTRE des lecteurs du texte PARTAGÉ vers Tentacle TV (feuille de partage d'iOS, intent `SEND`
 * d'Android, `tentacle://octave/import?shared=<texte>`). Chaque lecteur reconnaît UNE sorte de lien et dit quoi
 * en faire ; le premier qui répond l'emporte, dans l'ordre de la liste. Une sorte de lien de plus = UN lecteur
 * de plus ici, jamais un `if` de plus dans la route qui reçoit le partage.
 *
 * Ordre : la page d'Octave d'un serveur Tentacle (`/octave/open/…`, une playlist partagée entre comptes) ; une
 * playlist ou un album à IMPORTER (Spotify, Deezer, YouTube Music, Apple Music, un autre Tentacle) ; un titre
 * SHAZAM à chercher. Les sorties Bandcamp (lot « sf ») y entrent comme un lecteur `importRelease`.
 */

import { findShazamLink, localSharedTrackQuery, type SharedTrackQuery } from "../../music/shazamLink";
import { octaveOpenTarget } from "./octaveOpenLink";
import { SHARED_IMPORT_TEXT_MAX, sharedImportLink } from "./sharedImport";

export type SharedTextAction =
  /** Ouvrir une page d'Octave (`/octave/playlist/<id>`…) sur le serveur de l'app. */
  | { kind: "open"; path: string }
  /** Importer une playlist (ou un album) : la feuille d'import, lancée aussitôt. */
  | { kind: "importPlaylist"; link: string }
  /** Importer une sortie (Bandcamp, lot « sf ») : la feuille « Importer une sortie ». */
  | { kind: "importRelease"; url: string }
  /** Chercher un titre : `link` part au serveur pour le titre exact ; `local` est ce que le texte dit déjà. */
  | { kind: "searchTrack"; link: string; local: SharedTrackQuery | null };

export interface SharedTextReader {
  /** Nom stable du lecteur (journaux, tests). */
  id: string;
  read(text: string): SharedTextAction | null;
}

const CANDIDATE = /(?:https?|tentacle):\/\/[^\s<>"'«»]+/gi;
const TRAILING = /[.,;:!?)\]}…]+$/;

const openReader: SharedTextReader = {
  id: "open",
  read(text) {
    for (const match of text.matchAll(CANDIDATE)) {
      const path = octaveOpenTarget(match[0].replace(TRAILING, ""));
      if (path) return { kind: "open", path };
    }
    return null;
  },
};

const playlistImportReader: SharedTextReader = {
  id: "playlistImport",
  read(text) {
    const link = sharedImportLink(text);
    return link ? { kind: "importPlaylist", link } : null;
  },
};

const shazamReader: SharedTextReader = {
  id: "shazam",
  read(text) {
    const link = findShazamLink(text);
    return link ? { kind: "searchTrack", link: link.url, local: localSharedTrackQuery(text, link) } : null;
  },
};

/** Les lecteurs, dans l'ordre où ils sont essayés. */
export const SHARED_TEXT_READERS: readonly SharedTextReader[] = [openReader, playlistImportReader, shazamReader];

/** Ce que veut dire un texte partagé ; `null` si aucun lecteur ne le reconnaît. */
export function readSharedText(raw: string | null | undefined, readers: readonly SharedTextReader[] = SHARED_TEXT_READERS): SharedTextAction | null {
  if (!raw) return null;
  const text = raw.slice(0, SHARED_IMPORT_TEXT_MAX);
  for (const reader of readers) {
    const action = reader.read(text);
    if (action) return action;
  }
  return null;
}
