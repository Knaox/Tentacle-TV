/**
 * Octave — le PARTAGE SYSTÈME vers Tentacle TV (feuille de partage d'iOS, intent `SEND` d'Android) : le natif
 * ne fait que rendre le texte reçu, tel quel, dans le lien profond `tentacle://octave/import?shared=<texte>` ;
 * c'est cette règle qui y trouve le lien d'une playlist ou d'un album. Les apps partagent rarement un lien nu
 * (« Écoute … sur Deezer https://link.deezer.com/s/… ») : on cherche, dans l'ordre, le premier lien que
 * l'import RECONNAÎT (liste fermée d'hôtes, `recognizeImportUrl`), jamais un autre.
 */

import { recognizeImportUrl } from "../../music/musicImport";

/** Le paramètre du lien profond qui porte le texte partagé (traverse le natif : jamais renommé). */
export const SHARED_IMPORT_PARAM = "shared";
/** Au-delà, le texte partagé est tronqué (le natif borne aussi) : un lien de playlist tient bien en deçà. */
export const SHARED_IMPORT_TEXT_MAX = 4096;

const CANDIDATE = /(?:https?:\/\/|spotify:)[^\s<>"'«»]+/gi;
const TRAILING = /[.,;:!?)\]}…]+$/;

/** Le lien de playlist (ou d'album) d'un texte partagé, tel qu'écrit ; `null` si aucun n'est reconnu. */
export function sharedImportLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.slice(0, SHARED_IMPORT_TEXT_MAX);
  for (const match of text.matchAll(CANDIDATE)) {
    const candidate = match[0].replace(TRAILING, "");
    if (recognizeImportUrl(candidate)) return candidate;
  }
  return null;
}
