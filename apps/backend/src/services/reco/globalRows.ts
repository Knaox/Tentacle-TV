import { getSeerrConfig } from "../seerConfig";
import { getLibraryIndexMemo } from "./candidates/libraryMemo";
import { SERVER_PULSE_ROW_KEY, buildServerPulseRow } from "./serverPulse";
import { TRENDING_ROW_KEY, buildTrendingRow } from "./trendingRow";
import type { BuiltRow, RecoRowItem } from "./rowBuilder";

/**
 * Les rangées GLOBALES : servables dans TOUS les états du moteur (générique
 * sans clé, froid, désactivé, profil riche) — c'est elles qui font que la page
 * Recommandations n'est plus jamais vide. Elles sont aussi candidates à
 * l'accueil configurable (catalogue de `homeRowCatalog`) : une rangée qu'un
 * compte peut activer chez lui doit exister sur SA page, quel que soit son
 * état — d'où bestOfLibrary tissée en fin des pages personnalisées aussi.
 */
export const BEST_OF_LIBRARY_ROW_KEY = "bestOfLibrary";

export const GLOBAL_ROW_KEYS = [TRENDING_ROW_KEY, SERVER_PULSE_ROW_KEY, BEST_OF_LIBRARY_ROW_KEY] as const;

const BEST_OF_LIBRARY_SIZE = 24;

export function isGlobalRowKey(rowKey: string): boolean {
  return (GLOBAL_ROW_KEYS as readonly string[]).includes(rowKey);
}

interface GlobalRowContext {
  exclude: ReadonlySet<string>;
  includeVigie: boolean;
  tmdbConfigured: boolean;
}

/**
 * Répartition par genre principal en tour de rôle : représenter TOUTE la
 * collection, pas le seul genre dominant. Extraite du /coldstart, qui la
 * réutilise — une seule mécanique de diversité de bibliothèque.
 */
export function spreadByGenre<T extends { Genres?: string[] }>(entries: T[], max: number): T[] {
  const byGenre = new Map<string, T[]>();
  for (const e of entries) {
    const genre = e.Genres?.[0] ?? "";
    const bucket = byGenre.get(genre);
    if (bucket) bucket.push(e);
    else byGenre.set(genre, [e]);
  }
  const buckets = [...byGenre.values()];
  const pick: T[] = [];
  for (let rank = 0; pick.length < max; rank++) {
    let added = false;
    for (const bucket of buckets) {
      if (rank < bucket.length && pick.length < max) {
        pick.push(bucket[rank]);
        added = true;
      }
    }
    if (!added) break;
  }
  return pick;
}

/**
 * « Les mieux notés de votre bibliothèque » : le filet des états sans pool.
 * Différence assumée avec /coldstart : lui garde les titres VUS (on note ce
 * qu'on connaît), une rangée de recommandation les exclut.
 */
async function buildBestOfLibraryRow(userId: string, ctx: GlobalRowContext): Promise<BuiltRow> {
  const library = await getLibraryIndexMemo(userId);
  const eligible = library.entries
    .filter(
      (e) =>
        !e.played &&
        !e.inProgress &&
        !e.isFavorite &&
        e.hasPrimaryImage &&
        !ctx.exclude.has(e.key)
    )
    .sort((a, b) => (b.communityRating ?? 0) - (a.communityRating ?? 0));
  const items: RecoRowItem[] = spreadByGenre(eligible, BEST_OF_LIBRARY_SIZE).map((e) => ({
    key: e.key,
    mediaType: e.mediaType,
    tmdbId: e.tmdbId,
    title: e.name,
    year: e.ProductionYear ?? null,
    // posterPath null : le client rend l'affiche Jellyfin dès que
    // jellyfinItemId est posé — aucun appel TMDB nécessaire ici.
    posterPath: null,
    backdropPath: null,
    jellyfinItemId: e.itemId,
    source: "library",
    score: e.communityRating ?? 0,
    voteAverage: e.communityRating,
    reasons: [],
    providers: null,
  }));
  return { key: BEST_OF_LIBRARY_ROW_KEY, items, generatedAt: new Date().toISOString() };
}

/** Une rangée globale, par clé — lecture seule, zéro réseau. */
export async function buildGlobalRow(
  userId: string,
  rowKey: string,
  ctx: GlobalRowContext
): Promise<BuiltRow & { pending?: boolean }> {
  if (rowKey === TRENDING_ROW_KEY) return buildTrendingRow(userId, ctx);
  if (rowKey === SERVER_PULSE_ROW_KEY) return buildServerPulseRow(userId, ctx);
  return buildBestOfLibraryRow(userId, ctx);
}

function trendingServable(ctx: GlobalRowContext): boolean {
  return ctx.tmdbConfigured || getSeerrConfig() !== null;
}

/**
 * La liste annoncée dans les états SANS pool (générique, froid, désactivé).
 * Annonce sans vérifier le contenu : une rangée vide ne rend rien côté client,
 * et vérifier coûterait un scan bibliothèque dans GET /rows.
 */
export function fallbackRowList(ctx: GlobalRowContext): Array<{ key: string }> {
  const rows: Array<{ key: string }> = [];
  if (trendingServable(ctx)) rows.push({ key: TRENDING_ROW_KEY });
  rows.push({ key: SERVER_PULSE_ROW_KEY }, { key: BEST_OF_LIBRARY_ROW_KEY });
  return rows;
}

/**
 * Tisse les rangées globales dans une liste personnalisée (warming/ready) :
 * les tendances sont servies à TOUS, même profil riche ; le pouls complète
 * community (souvent vide sous son seuil sur un petit serveur) ; bestOfLibrary
 * ferme la page — inLibrary couvre le même terrain, mais un compte qui l'a
 * activée sur son accueil doit la trouver dans sa page, profil riche compris.
 */
export function weaveGlobalRows(
  rows: Array<{ key: string; seedTitle?: string }>,
  ctx: GlobalRowContext
): Array<{ key: string; seedTitle?: string }> {
  const out = [...rows];
  if (trendingServable(ctx)) {
    const anchor = out.findIndex((r) => r.key === "discover");
    const fallback = out.findIndex((r) => r.key === "inLibrary");
    const at = anchor >= 0 ? anchor + 1 : fallback >= 0 ? fallback + 1 : out.length;
    out.splice(at, 0, { key: TRENDING_ROW_KEY });
  }
  const exploration = out.findIndex((r) => r.key === "exploration");
  out.splice(exploration >= 0 ? exploration : out.length, 0, { key: SERVER_PULSE_ROW_KEY });
  out.push({ key: BEST_OF_LIBRARY_ROW_KEY });
  return out;
}
