/**
 * Octave — la frappe de l'utilisateur devient une requête FTS5. Pur.
 *
 * Chaque mot est un PRÉFIXE (« bri wi » trouve « Bright Wish » pendant la
 * frappe), tous exigés (ET implicite de FTS5), entre guillemets : aucune
 * syntaxe de FTS5 (`OR`, `NEAR`, `-`, `:`…) ne passe de la frappe à la requête.
 * Accents : retirés par le tokeniseur (`remove_diacritics 2`) ; ligatures :
 * pliées des deux côtés (`foldForSearch`).
 */

import { foldForSearch } from "./rowCodec";

const MAX_TOKENS = 8;
const MAX_TOKEN_LENGTH = 40;

export function searchTokens(input: string): string[] {
  return foldForSearch(input.normalize("NFC"))
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .slice(0, MAX_TOKENS)
    .map((t) => t.slice(0, MAX_TOKEN_LENGTH));
}

/** `null` : rien à chercher (vide, ponctuation seule). */
export function ftsMatchExpression(input: string): string | null {
  const tokens = searchTokens(input);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}
