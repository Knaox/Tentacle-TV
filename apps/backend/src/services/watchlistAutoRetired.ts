import type { LibItem } from "./jellyfin";
import { getPrisma, hasPrisma } from "./db";
import { getJellyfinApiKey, getJellyfinUrl } from "./configStore";
import { broadcastToUser } from "./wsManager";
import { pokeProfile } from "./reco/jobs";

// Séries retirées AUTOMATIQUEMENT de « Ma liste » parce que tout le disponible
// était vu (table watchlist_auto_retired, écrite par le client via
// routes/watchlist.ts). Dès qu'un épisode de l'une d'elles entre en
// bibliothèque — n'importe quel épisode hors saison 0, pas seulement une
// nouvelle saison : une série hebdomadaire revient à l'épisode suivant — le
// like est reposé POUR LE COMPTE de l'utilisateur avec la clé admin, et la
// ligne s'efface. Une série retirée à la main n'a jamais de ligne : elle ne
// revient pas. Branché sur le diff d'IDs de libraryAddedNotifier, hors des
// préférences push.

const DB_CHUNK = 1000; // lignes par deleteMany

/**
 * Séries (saison > 0) dont un épisode vient d'entrer — uniques. Même filtre
 * que useSeriesWatchState côté client : un spécial ne compte pas.
 */
export function seriesIdsToRestore(items: LibItem[]): string[] {
  const ids = new Set<string>();
  for (const it of items) {
    if (it.Type !== "Episode" || !it.SeriesId) continue;
    if ((it.ParentIndexNumber ?? 0) <= 0) continue;
    ids.add(it.SeriesId);
  }
  return [...ids];
}

/** Like posé pour le compte d'un utilisateur, clé admin. Idempotent côté Jellyfin. */
async function likeItemForUser(userId: string, itemId: string): Promise<boolean> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return false;
  try {
    const res = await fetch(
      `${url}/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(itemId)}/Rating?likes=true`,
      { method: "POST", headers: { "X-Emby-Token": apiKey }, signal: AbortSignal.timeout(10_000) },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Remet dans Ma liste les séries suivies dont un épisode vient d'arriver. Ne lève jamais. */
export async function restoreAutoRetiredSeries(items: LibItem[]): Promise<void> {
  try {
    const seriesIds = seriesIdsToRestore(items);
    if (seriesIds.length === 0 || !hasPrisma()) return;
    const prisma = getPrisma();
    const rows = await prisma.watchlistAutoRetired.findMany({ where: { seriesId: { in: seriesIds } } });
    if (rows.length === 0) return;

    const restoredFor = new Set<string>();
    for (const row of rows) {
      const short = row.jellyfinUserId.slice(0, 8);
      if (!(await likeItemForUser(row.jellyfinUserId, row.seriesId))) {
        // Ligne conservée : nouvelle tentative au prochain épisode.
        console.warn(`[Watchlist] remise[${short}] série ${row.seriesId} : Jellyfin n'a pas suivi`);
        continue;
      }
      // deleteMany, jamais delete par clé : un retrait manuel concurrent côté
      // client a pu effacer la ligne entre-temps (P2025 sinon).
      await prisma.watchlistAutoRetired.deleteMany({
        where: { seriesId: row.seriesId, jellyfinUserId: row.jellyfinUserId },
      });
      restoredFor.add(row.jellyfinUserId);
      console.log(`[Watchlist] remise[${short}] série ${row.seriesId} dans Ma liste`);
    }
    // Une diffusion par utilisateur, après la boucle — pas une par série.
    for (const userId of restoredFor) {
      broadcastToUser(userId, "watchlist");
      // Les likes Jellyfin sont un signal du moteur de reco, et le WS Jellyfin
      // est muet à la clé d'API (cf. jellyfinWs.ts) : on pousse le profil.
      pokeProfile(userId);
    }
  } catch (err) {
    console.error("[Watchlist] remise échouée:", err);
  }
}

/** Séries disparues de la bibliothèque : leurs suivis n'ont plus d'objet. */
export async function forgetRemovedSeries(removedIds: string[]): Promise<void> {
  if (removedIds.length === 0 || !hasPrisma()) return;
  try {
    const prisma = getPrisma();
    for (let i = 0; i < removedIds.length; i += DB_CHUNK) {
      await prisma.watchlistAutoRetired.deleteMany({
        where: { seriesId: { in: removedIds.slice(i, i + DB_CHUNK) } },
      });
    }
  } catch (err) {
    console.error("[Watchlist] purge des suivis échouée:", err);
  }
}
