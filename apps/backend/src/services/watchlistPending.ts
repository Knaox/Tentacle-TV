import type { LibItem } from "./jellyfinLibrary";
import { getPrisma, hasPrisma } from "./db";
import { favoriteItemForUser, likeItemForUser } from "./jellyfinLikes";
import { libraryTmdbIndex, type TmdbMediaType } from "./jellyfinTmdbLookup";
import { broadcastToUser } from "./wsManager";
import { pokeProfile } from "./reco/jobs";
import { refreshLibraryMemo } from "./reco/candidates/libraryMemo";

// Ce qu'un titre qui n'est PAS encore dans la bibliothèque attend pour être
// posé chez Jellyfin (table watchlist_pending), un DRAPEAU par ligne :
//   • « watchlist » — Ma liste, posée depuis une carte hors bibliothèque
//     (recommandation, recherche, extension de demandes) : routes/watchlistTmdb.ts ;
//   • « favorite »  — J'aime, le cœur, donné dans « Affiner »
//     (services/swipe/swipeFavorites.ts) ou sur une carte hors bibliothèque
//     (routes/likesTmdb.ts, qui pose AUSSI le like du catalogue, user_likes :
//     le goût le lit tout de suite ; l'arrivée l'efface, le cœur prend le relais).
// Le drapeau est posé POUR LE COMPTE de l'utilisateur avec la clé admin dès
// que le titre arrive, puis la ligne s'efface. Deux chemins, comme les séries
// sorties automatiquement (watchlistAutoRetired) :
//   • l'ARRIVÉE, branchée sur le diff d'IDs de libraryAddedNotifier : un film
//     par son TMDB, une série par le sien — l'item Series lui-même ou le
//     premier de ses épisodes, qui porte le TMDB de sa série ;
//   • un BALAYAGE périodique, pour ce qui est arrivé pendant une coupure ou
//     avant que la ligne n'existe : une seule liste de la bibliothèque, pas
//     une requête par titre.

const DB_CHUNK = 500;

export type PendingKey = `${TmdbMediaType}:${number}`;
export type PendingFlag = "watchlist" | "favorite";

export function pendingKey(mediaType: TmdbMediaType, tmdbId: number): PendingKey {
  return `${mediaType}:${tmdbId}`;
}

/** Ce que pose chaque drapeau, et l'évènement qui prévient les écrans du compte. */
const FLAG_ACTIONS: Record<PendingFlag, {
  apply: (userId: string, itemId: string) => Promise<boolean>;
  carousel: string;
  label: string;
}> = {
  watchlist: { apply: (userId, itemId) => likeItemForUser(userId, itemId), carousel: "watchlist", label: "Ma liste" },
  favorite: { apply: (userId, itemId) => favoriteItemForUser(userId, itemId), carousel: "favorites", label: "J'aime" },
};

/** Le vocabulaire de `user_likes` (« series ») — celui des notes, pas celui de TMDB. */
export function likeMediaType(mediaType: string): "movie" | "series" {
  return mediaType === "movie" ? "movie" : "series";
}

/** Le drapeau d'une ligne ; une ligne d'avant la colonne vaut « Ma liste ». */
export function pendingFlagOf(value: string | null | undefined): PendingFlag {
  return value === "favorite" ? "favorite" : "watchlist";
}

/**
 * Ce que des arrivées permettent de poser : clé TMDB → item Jellyfin visé.
 * Un film se vise lui-même ; une série par son item Series — qu'on le voie
 * arriver, ou qu'un épisode le désigne.
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
  flag: string;
}

const ROW_SELECT = { jellyfinUserId: true, mediaType: true, tmdbId: true, flag: true } as const;

/** Met un drapeau de côté jusqu'à l'arrivée du titre (idempotent). */
export async function holdPendingFlag(
  userId: string,
  mediaType: TmdbMediaType,
  tmdbId: number,
  flag: PendingFlag
): Promise<void> {
  await getPrisma().watchlistPending.upsert({
    where: { jellyfinUserId_mediaType_tmdbId_flag: { jellyfinUserId: userId, mediaType, tmdbId, flag } },
    create: { jellyfinUserId: userId, mediaType, tmdbId, flag },
    update: {},
  });
}

/** Retire un drapeau mis de côté ; vrai s'il y en avait un. */
export async function dropPendingFlag(
  userId: string,
  mediaType: TmdbMediaType,
  tmdbId: number,
  flag: PendingFlag
): Promise<boolean> {
  const res = await getPrisma().watchlistPending.deleteMany({
    where: { jellyfinUserId: userId, mediaType, tmdbId, flag },
  });
  return res.count > 0;
}

/**
 * Pose chaque drapeau dont le titre est là, efface les lignes que Jellyfin a
 * suivies, et prévient chaque compte une seule fois par drapeau. Une ligne
 * que Jellyfin refuse reste : elle repassera au prochain balayage.
 */
async function applyRows(rows: readonly PendingRow[], targets: ReadonlyMap<string, string>): Promise<number> {
  const prisma = getPrisma();
  const changed = new Map<string, Set<PendingFlag>>();
  let applied = 0;
  for (const row of rows) {
    const itemId = targets.get(`${row.mediaType}:${row.tmdbId}`);
    if (!itemId) continue;
    const flag = pendingFlagOf(row.flag);
    const action = FLAG_ACTIONS[flag];
    const short = row.jellyfinUserId.slice(0, 8);
    if (!(await action.apply(row.jellyfinUserId, itemId))) {
      console.warn(`[Watchlist] arrivée[${short}] ${row.mediaType}:${row.tmdbId} (${action.label}) : Jellyfin n'a pas suivi`);
      continue;
    }
    // deleteMany : un retrait concurrent a pu effacer la ligne entre-temps.
    await prisma.watchlistPending.deleteMany({
      where: { jellyfinUserId: row.jellyfinUserId, mediaType: row.mediaType, tmdbId: row.tmdbId, flag: row.flag },
    });
    // Le cœur de Jellyfin porte désormais le « j'aime » : le like du catalogue
    // n'a plus d'objet — gardé, il survivrait à un cœur retiré plus tard.
    if (flag === "favorite") {
      await prisma.userLike.deleteMany({
        where: { jellyfinUserId: row.jellyfinUserId, mediaType: likeMediaType(row.mediaType), tmdbId: row.tmdbId },
      });
    }
    const flags = changed.get(row.jellyfinUserId) ?? new Set<PendingFlag>();
    flags.add(flag);
    changed.set(row.jellyfinUserId, flags);
    applied++;
    console.log(`[Watchlist] arrivée[${short}] ${row.mediaType}:${row.tmdbId} → ${action.label}`);
  }
  for (const [userId, flags] of changed) {
    for (const flag of flags) broadcastToUser(userId, FLAG_ACTIONS[flag].carousel);
    // Posé à la clé d'API, le drapeau n'arrive pas par le WS Jellyfin : l'index
    // de la reco (exclusions) et le profil de goût se relisent d'ici.
    refreshLibraryMemo(userId);
    pokeProfile(userId);
  }
  return applied;
}

/** Les drapeaux mis de côté dont le titre vient d'arriver sont posés. Ne lève jamais. */
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
      select: ROW_SELECT,
    });
    if (rows.length > 0) await applyRows(rows, targets);
  } catch (err) {
    console.error("[Watchlist] arrivée des titres mis de côté échouée:", err);
  }
}

/**
 * Balayage : les lignes dont le titre est DÉJÀ dans la bibliothèque. Rien à
 * faire sans ligne — ni requête Jellyfin, ni liste de la bibliothèque.
 * Rend le nombre de drapeaux posés. Ne lève jamais.
 */
export async function sweepPendingWatchlist(): Promise<number> {
  try {
    if (!hasPrisma()) return 0;
    const prisma = getPrisma();
    const rows: PendingRow[] = [];
    for (let skip = 0; ; skip += DB_CHUNK) {
      const page = await prisma.watchlistPending.findMany({
        select: ROW_SELECT,
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
