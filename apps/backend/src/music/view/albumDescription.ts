/**
 * Octave — la description d'un album, telle que Jellyfin la tient (`Overview` : celle d'un `album.nfo`, d'un
 * fournisseur de métadonnées ou saisie à la main). L'index ne la garde pas (elle ne sert qu'à la vue album) : UNE
 * lecture de l'élément, au nom du compte (ses droits), à l'ouverture de l'album. Un Jellyfin muet ou lent : pas de
 * description, jamais une vue album en échec.
 */

import { jfAdmin, q } from "../jellyfin/musicJellyfin";

/** Au-delà, la description est coupée (une fiche n'est pas un livret). */
export const ALBUM_DESCRIPTION_MAX = 4_000;

/** La description à servir : espaces de bord retirés, fins de ligne unifiées, bornée ; vide → `null`. */
export function descriptionOf(overview: string | null | undefined): string | null {
  const text = (overview ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return null;
  return text.length > ALBUM_DESCRIPTION_MAX ? `${text.slice(0, ALBUM_DESCRIPTION_MAX - 1).trimEnd()}…` : text;
}

export async function albumDescription(userId: string, albumId: string): Promise<string | null> {
  const result = await jfAdmin<{ Overview?: string | null }>(
    `/Items/${q(albumId)}?userId=${q(userId)}&Fields=Overview&EnableImages=false`,
    { timeoutMs: 5_000 },
  );
  return result.ok ? descriptionOf(result.data.Overview) : null;
}
