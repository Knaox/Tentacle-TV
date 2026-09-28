import { getPrisma, hasPrisma } from "../db";
import { sweepPendingWatchlist } from "../watchlistPending";

/**
 * RATTRAPAGE, une seule fois par serveur : les likes d'Affiner donnés avant
 * que le like ne pose le cœur de la bibliothèque (le bureau 1.24.0 et son
 * serveur les enregistraient sans cœur). Chacun devient un drapeau
 * « favorite » de watchlist_pending ; le balayage pose aussitôt ceux dont le
 * titre est là, l'arrivée posera les autres.
 *
 * La marque (`server_config`) est écrite AVANT le balayage : un arrêt en
 * route ne rejoue pas le rattrapage — les lignes posées attendent le
 * balayage suivant, elles.
 */
export const SWIPE_FAVORITES_BACKFILL_KEY = "swipe_likes_favorited_at";

/** Rend le nombre de likes rattrapés (0 : déjà fait, rien à faire, ou pas de base). Ne lève jamais. */
export async function backfillSwipeFavorites(): Promise<number> {
  try {
    if (!hasPrisma()) return 0;
    const prisma = getPrisma();
    const done = await prisma.serverConfig.findUnique({ where: { key: SWIPE_FAVORITES_BACKFILL_KEY } });
    if (done) return 0;
    const likes = await prisma.userSwipe.findMany({
      where: { verdict: { in: ["like", "superlike"] } },
      select: { jellyfinUserId: true, mediaType: true, tmdbId: true },
    });
    if (likes.length > 0) {
      await prisma.watchlistPending.createMany({
        data: likes.map((like) => ({ ...like, flag: "favorite" })),
        skipDuplicates: true,
      });
    }
    const stamp = new Date().toISOString();
    await prisma.serverConfig.upsert({
      where: { key: SWIPE_FAVORITES_BACKFILL_KEY },
      create: { key: SWIPE_FAVORITES_BACKFILL_KEY, value: stamp },
      update: {},
    });
    if (likes.length > 0) {
      console.log(`[Swipe] rattrapage : ${likes.length} like(s) d'Affiner deviennent des cœurs`);
      await sweepPendingWatchlist();
    }
    return likes.length;
  } catch (err) {
    console.error("[Swipe] rattrapage des likes d'Affiner en cœurs échoué :", err);
    return 0;
  }
}
