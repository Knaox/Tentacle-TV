import type { LibItem } from "./jellyfinLibrary";
import { getPrisma, hasPrisma } from "./db";
import { likeItemForUser } from "./jellyfinLikes";
import { libraryTmdbIndex, type TmdbMediaType } from "./jellyfinTmdbLookup";
import { broadcastToUser } from "./wsManager";
import { pokeProfile } from "./reco/jobs";

// « Ma liste » posée sur un titre qui n'est PAS encore dans la bibliothèque
// (table watchlist_pending, écrite par le client via routes/watchlist.ts) :
// une carte hors bibliothèque — recommandation, recherche, extension de
// demandes — met le titre de côté, et il entre dans « Ma liste » dès qu'il
// arrive. Le like est posé POUR LE COMPTE de l'utilisateur avec la clé admin,
// puis la ligne s'efface. Deux chemins, comme les séries sorties
// automatiquement (watchlistAutoRetired) :
//   • l'ARRIVÉE, branchée sur le diff d'IDs de libraryAddedNotifier : un film
//     par son TMDB, une série par le sien — l'item Series lui-même ou le
//     premier de ses épisodes, qui porte le TMDB de sa série ;
//   • un BALAYAGE périodique, pour ce qui est arrivé pendant une coupure ou
//     avant que la ligne n'existe : une seule liste de la bibliothèque, pas
//     une requête par titre.

const DB_CHUNK = 500;

export type PendingKey = `${TmdbMediaType}:${number}`;

export function pendingKey(mediaType: TmdbMediaType, tmdbId: number): PendingKey {
  return `${mediaType}:${tmdbId}`;
}

/**
 * Ce que des arrivées permettent de mettre dans « Ma liste » : clé TMDB →
 * item Jellyfin à liker. Un film se like lui-même ; une série se like par
 * son item Series — qu'on le voie arriver, ou qu'un épisode le désigne.
 */
export function pendingTargetsOf(items: readonly LibItem[]): Map<PendingKey, string> {
  const targets = new Map<PendingKey, string>();
  for (const it of items) {
    if (it.Type === "Movie" && it.tmdbId != null) targets.set(pendingKey("movie", it.tmdbId), it.Id);
    else if (it.Type === "Series" && it.tmdbId != null) targets.set(pendingKey("tv", it.tmdbId), it.Id);
    else if (it.Type === "Episode" && it.SeriesId && it.seriesTmdbId != null) {
      const key = pendingKey("tv", it.seriesTmdbId);
      // L'item Series, s'il est dans le lot, reste la cible : c'est le même.
      if (!targets.has(key)) targets.set(key, it.SeriesId);
    }
  }
  return targets;
}

interface PendingRow {
  jellyfinUserId: string;
  mediaType: string;
  tmdbId: number;
}

/**
 * Like chaque ligne dont le titre est là, efface celles que Jellyfin a
 * suivies, et prévient chaque compte une seule fois. Une ligne que Jellyfin
 * refuse reste : elle repassera au prochain balayage.
 */
async function applyRows(rows: readonly PendingRow[], targets: ReadonlyMap<string, string>): Promise<number> {
  const prisma = getPrisma();
  const listedFor = new Set<string>();
  let applied = 0;
  for (const row of rows) {
    const itemId = targets.get(`${row.mediaType}:${row.tmdbId}`);
    if (!itemId) continue;
    const short = row.jellyfinUserId.slice(0, 8);
    if (!(await likeItemForUser(row.jellyfinUserId, itemId))) {
      console.warn(`[Watchlist] arrivée[${short}] ${row.mediaType}:${row.tmdbId} : Jellyfin n'a pas suivi`);
      continue;
    }
    // deleteMany : un retrait concurrent a pu effacer la ligne entre-temps.
    await prisma.watchlistPending.deleteMany({
      where: { jellyfinUserId: row.jellyfinUserId, mediaType: row.mediaType, tmdbId: row.tmdbId },
    });
    listedFor.add(row.jellyfinUserId);
    applied++;
    console.log(`[Watchlist] arrivée[${short}] ${row.mediaType}:${row.tmdbId} → Ma liste`);
  }
  for (const userId of listedFor) {
    broadcastToUser(userId, "watchlist");
    // Les likes Jellyfin nourrissent la reco, et le WS Jellyfin est muet à la clé d'API.
    pokeProfile(userId);
  }
  return applied;
}

/** Les titres mis de côté qui viennent d'arriver entrent dans « Ma liste ». Ne lève jamais. */
export async function applyPendingWatchlist(items: readonly LibItem[]): Promise<void> {
  try {
    const targets = pendingTargetsOf(items);
    if (targets.size === 0 || !hasPrisma()) return;
    const byType = { movie: [] as number[], tv: [] as number[] };
    for (const key of targets.keys()) {
      const [type, id] = key.split(":");
      byType[type as TmdbMediaType].push(Number(id));
    }
    const rows = await getPrisma().watchlistPending.findMany({
      where: {
        OR: [
          ...(byType.movie.length > 0 ? [{ mediaType: "movie", tmdbId: { in: byType.movie } }] : []),
          ...(byType.tv.length > 0 ? [{ mediaType: "tv", tmdbId: { in: byType.tv } }] : []),
        ],
      },
      select: { jellyfinUserId: true, mediaType: true, tmdbId: true },
    });
    if (rows.length > 0) await applyRows(rows, targets);
  } catch (err) {
    console.error("[Watchlist] arrivée des titres mis de côté échouée:", err);
  }
}

/**
 * Balayage : les lignes dont le titre est DÉJÀ dans la bibliothèque. Rien à
 * faire sans ligne — ni requête Jellyfin, ni liste de la bibliothèque.
 * Rend le nombre de titres mis dans « Ma liste ». Ne lève jamais.
 */
export async function sweepPendingWatchlist(): Promise<number> {
  try {
    if (!hasPrisma()) return 0;
    const prisma = getPrisma();
    const rows: PendingRow[] = [];
    for (let skip = 0; ; skip += DB_CHUNK) {
      const page = await prisma.watchlistPending.findMany({
        select: { jellyfinUserId: true, mediaType: true, tmdbId: true },
        orderBy: { createdAt: "asc" },
        skip,
        take: DB_CHUNK,
      });
      rows.push(...page);
      if (page.length < DB_CHUNK) break;
    }
    if (rows.length === 0) return 0;
    const index = await libraryTmdbIndex();
    if (!index) return 0;
    return await applyRows(rows, index);
  } catch (err) {
    console.error("[Watchlist] balayage des titres mis de côté échoué:", err);
    return 0;
  }
}
