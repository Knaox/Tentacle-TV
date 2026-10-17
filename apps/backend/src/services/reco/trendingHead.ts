import { getWatchProviderDirectory } from "../tmdb/providerDirectory";
import { attachProviders } from "./attachProviders";
import { expandFamilies, itemMatchesFilter } from "./providerFilter";
import { RECO_TRENDING_NOW_ROW_KEY } from "./recoPageTypes";
import { rightsFilterFor } from "./recoRights";
import type { RecoRowItem } from "./rowItem";
import type { ServeContext } from "./serveContext";
import { TRENDING_ROW_KEY, buildTrendingRow } from "./trendingRow";

/**
 * « Tendances actuelles » : la rangée de TÊTE de la page reco (capacité
 * `reco.trending`, `?trendingNow=1`). Les tendances TMDB de la semaine, films
 * et séries entrelacés, dans l'ordre de TMDB — ni le goût ni les statistiques
 * du compte ne les filtrent ni ne les réordonnent (contrairement à la rangée
 * `trending` de la page, passée par `gateGlobalRow`). Restent les règles de
 * TOUTE rangée servie : exclusions du compte (« Ne plus me proposer », note,
 * vu, entamé, favori, Ma liste), « bibliothèque seule », droits du compte,
 * filtre de plateformes.
 *
 * Servie au moment de la requête, jamais dans un snapshot : la matière est la
 * sentinelle globale des tendances (une lecture, zéro réseau, rafraîchie
 * toutes les 12 h par le job reco).
 */

/** Une rangée de tête trop mince n'est pas servie (même seuil que la page). */
export const TRENDING_HEAD_MIN_ITEMS = 6;

interface ServedRow {
  key: string;
  items: RecoRowItem[];
}

/** Les titres de la rangée de tête pour CE compte ; vide si elle n'a pas lieu d'être. */
export async function trendingHeadItems(
  userId: string,
  ctx: Pick<ServeContext, "exclude" | "includeVigie" | "tmdbConfigured" | "trendingNow">,
  providers: number[] | null,
): Promise<RecoRowItem[]> {
  // Sans clé TMDB, la reco n'est pas activée : rien, même si Vigie connaît des tendances.
  if (!ctx.tmdbConfigured || !ctx.trendingNow) return [];
  const built = await buildTrendingRow(userId, { exclude: ctx.exclude, includeVigie: ctx.includeVigie });
  if (built.items.length === 0) return [];
  const allowed = await rightsFilterFor(userId, built.items);
  let items = built.items.filter(allowed);
  await attachProviders(items);
  if (providers) {
    const wanted = expandFamilies(providers, (await getWatchProviderDirectory()).providers);
    items = items.filter((item) => itemMatchesFilter(item.providers, wanted));
  }
  return items;
}

/**
 * Pur : la page avec sa rangée de tête. Sans assez de titres, la page reste
 * telle quelle. Sinon : la rangée en tête, la rangée `trending` (goûtée) en
 * moins, et les rangées suivantes sans les titres de la tête — un titre ne
 * paraît qu'une fois par page ; une rangée que cela vide, ou fait passer sous
 * le seuil, n'est plus servie.
 */
export function withTrendingHead<T extends ServedRow>(
  rows: readonly T[],
  head: readonly RecoRowItem[],
  minItems = TRENDING_HEAD_MIN_ITEMS,
): Array<T | ServedRow> {
  if (head.length < minItems) return [...rows];
  const shown = new Set(head.map((item) => item.key));
  const out: Array<T | ServedRow> = [{ key: RECO_TRENDING_NOW_ROW_KEY, items: [...head] }];
  for (const row of rows) {
    if (row.key === TRENDING_ROW_KEY || row.key === RECO_TRENDING_NOW_ROW_KEY) continue;
    const items = row.items.filter((item) => !shown.has(item.key));
    if (items.length === row.items.length) {
      out.push(row);
      continue;
    }
    if (items.length === 0 || items.length < minItems) continue;
    out.push({ ...row, items });
  }
  return out;
}
