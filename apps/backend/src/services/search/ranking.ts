/**
 * Le classement FINAL d'un titre, une fois les droits du compte appliqués :
 * le score du moteur (BM25, préfixes, fautes) multiplié par ce que le moteur
 * ne peut pas savoir.
 *
 * - la FORME de la correspondance : titre exact (×2,2), tous les termes au
 *   début de mots du titre (×1,25), et le titre qui COMMENCE par la requête
 *   (×1,35 de plus) — « alien » met Alien avant Aliens vs Predator ;
 * - la COUVERTURE du titre, fautes comprises (jusqu'à ×1,6) : « breking bad »
 *   couvre tout *Breaking Bad*, un tiers d'*El Camino : Un film « Breaking
 *   Bad »* — mesuré sur une vraie bibliothèque, le film passait devant ;
 * - l'ANNÉE citée : dans le titre (« blade runner 2049 », ×1,8), ou l'année
 *   du film, ou comprise dans la diffusion d'une série (×1,6) ;
 * - le TYPE cité (« série breaking bad », ×1,3) ;
 * - le COMPTE : un titre entamé (×1,12), un favori (×1,08) — ce qu'on
 *   cherche le plus souvent, c'est ce qu'on est en train de regarder.
 *
 * Jamais de pénalité : un indice qui ne correspond pas ne fait rien descendre,
 * il ne fait que monter ce qui correspond.
 */

import type { ParsedSearchQuery } from "../../search/searchText";
import type { SearchUserData } from "../../search/searchTypes";
import type { CatalogItem } from "./catalogSource";
import type { ItemCandidate } from "./engine";

export function rankBoost(
  item: CatalogItem,
  candidate: ItemCandidate,
  title: { folded: string; words: string[] } | undefined,
  parsed: ParsedSearchQuery,
  userData: SearchUserData | undefined,
): number {
  let boost = 1;
  if (candidate.exactTitle) boost *= 2.2;
  else if (candidate.analysis.titleSolid) {
    boost *= 1.25;
    // La saisie entière (« the off » → The Office), ou ses seuls termes quand
    // un mot vide a été écarté (« fast furious » → Fast & Furious).
    const head = title?.folded ?? "";
    if (head.startsWith(parsed.folded) || head.startsWith(parsed.terms.join(" "))) boost *= 1.35;
  }
  if (candidate.analysis.byTitle) boost *= 1 + 0.6 * candidate.analysis.coverage;
  if (parsed.year !== null) {
    const year = parsed.year;
    if (title !== undefined && title.words.includes(String(year))) boost *= 1.8;
    else if (item.year === year) boost *= 1.6;
    else if (item.type === "Series" && item.year !== null && item.year <= year && (item.endYear ?? 9999) >= year) {
      boost *= 1.6;
    }
  }
  if (parsed.type !== null && item.type === parsed.type) boost *= 1.3;
  if (userData !== undefined) {
    if (!userData.Played && (userData.PlayedPercentage ?? 0) > 0) boost *= 1.12;
    if (userData.IsFavorite) boost *= 1.08;
  }
  return boost;
}
