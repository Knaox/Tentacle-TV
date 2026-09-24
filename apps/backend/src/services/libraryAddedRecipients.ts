import { getPrisma } from "./db";
import type { LibItem } from "./jellyfinLibrary";
import { indexClaims, isClaimed } from "./libraryAddedDedup";
import { isPushPrefEnabled } from "./pushPreferences";
import { libraryIdentityKeys, librarySeasonKeys, recentlyAnnounced, strongestKeys } from "./announcedRegistry";
import { loadPushLangs, type PushLang } from "./pushLang";

// À qui annoncer une arrivée, et quoi. Seule compte la vérité Jellyfin : le
// contenu est dans la bibliothèque, on n'attend plus que Jellyseerr le voie.
// Deux raisons de recevoir l'annonce :
//  - l'avoir DEMANDÉ : une revendication active (content_claims, posée et
//    entretenue par le plugin de demandes tant qu'une demande attend) —
//    préférence « Contenu demandé disponible », activée par défaut ;
//  - être abonné à TOUS les ajouts — préférence « Ajouts en bibliothèque » —,
//    demandes des autres comprises.
// Un demandeur abonné à tout ne reçoit sa demande qu'une fois, sous sa forme
// personnelle. Seuls comptent les utilisateurs qui ont un appareil inscrit.

/** Déjà annoncé à cet utilisateur depuis moins que ça (par le pipeline Seer,
 *  ou avant un redémarrage) : pas deux fois. La nouveauté elle-même est jugée
 *  en amont, par la reconnaissance des contenus (libraryPresence). */
export const IDENTITY_WINDOW_MS = 48 * 60 * 60_000;
/** Sa saison annoncée depuis moins que ça : l'épisode est absorbé (pack rangé
 *  en plusieurs fois) ; au-delà, il s'annonce (diffusion hebdomadaire). */
export const SEASON_WINDOW_MS = 6 * 60 * 60_000;

export interface RecipientPlan {
  userId: string;
  lang: PushLang;
  /** Ses demandes arrivées. */
  requested: LibItem[];
  /** Les autres nouveautés, s'il est abonné à tout. */
  others: LibItem[];
  /** Épisodes d'une saison qu'on vient de lui annoncer : silence. */
  absorbed: LibItem[];
}

export async function planRecipients(items: LibItem[], now = Date.now()): Promise<RecipientPlan[]> {
  const announceable = items.filter((it) => it.Type === "Movie" || it.Type === "Episode");
  if (announceable.length === 0) return [];
  const prisma = getPrisma();

  const devices = await prisma.pushDevice.findMany({
    select: { jellyfinUserId: true },
    distinct: ["jellyfinUserId"],
  });
  const userIds = devices.map((d) => d.jellyfinUserId);
  if (userIds.length === 0) return [];

  const claims = await prisma.contentClaim.findMany({
    where: { expiresAt: { gt: new Date(now) } },
    select: { tmdbId: true, jellyfinUserId: true, title: true, mediaType: true },
  });
  const claimIndex = indexClaims(claims);
  const prefs = await prisma.notificationPreference.findMany({ where: { jellyfinUserId: { in: userIds } } });
  const prefByUser = new Map(prefs.map((p) => [p.jellyfinUserId, p]));

  const plans: RecipientPlan[] = [];
  for (const userId of userIds) {
    const pref = prefByUser.get(userId);
    const wantsAll = isPushPrefEnabled(pref, "libraryAdded");
    const wantsRequests = isPushPrefEnabled(pref, "seerAvailable");
    const own = claimIndex.get(userId);
    const requested: LibItem[] = [];
    const others: LibItem[] = [];
    for (const it of announceable) {
      const mine = isClaimed(it, own);
      if (mine && (wantsRequests || wantsAll)) requested.push(it);
      else if (!mine && wantsAll) others.push(it);
    }
    if (requested.length + others.length === 0) continue;
    const plan = await dropAlreadyAnnounced(userId, requested, others, now);
    if (plan) plans.push(plan);
  }

  const langs = await loadPushLangs(plans.map((p) => p.userId));
  for (const p of plans) p.lang = langs.get(p.userId) ?? "fr";
  return plans;
}

/** Retire ce qu'on vient de lui annoncer, et absorbe les épisodes d'une saison tout juste annoncée. */
async function dropAlreadyAnnounced(
  userId: string,
  requested: LibItem[],
  others: LibItem[],
  now: number,
): Promise<RecipientPlan | null> {
  const all = [...requested, ...others];
  const identityOf = (it: LibItem) => strongestKeys(libraryIdentityKeys(it));
  const seasonOf = (it: LibItem) => strongestKeys(librarySeasonKeys(it));
  const recentIdentity = await recentlyAnnounced(userId, all.flatMap(identityOf), now - IDENTITY_WINDOW_MS);
  const recentSeasons = await recentlyAnnounced(userId, all.flatMap(seasonOf), now - SEASON_WINDOW_MS);
  const absorbed: LibItem[] = [];
  const keep = (it: LibItem): boolean => {
    if (identityOf(it).some((k) => recentIdentity.has(k))) return false;
    if (seasonOf(it).some((k) => recentSeasons.has(k))) {
      absorbed.push(it);
      return false;
    }
    return true;
  };
  const plan: RecipientPlan = {
    userId,
    lang: "fr",
    requested: requested.filter(keep),
    others: others.filter(keep),
    absorbed,
  };
  return plan.requested.length + plan.others.length + plan.absorbed.length > 0 ? plan : null;
}
