import {
  exactPushKey,
  filterAnnounced,
  isAnnounced,
  seerContentKeys,
  seerSeasonKeys,
  type RegistryClaim,
} from "./announcedRegistry";
import {
  checkJellyfinPresence,
  checkSeasonsPresence,
  parseSeerAvailability,
  resolveSeerContent,
} from "./seerAvailabilityGuard";

// Planificateur de push des annonces de dispo Seer — RÈGLE PRODUIT (Damien,
// juillet 2026) : une saison se notifie QUAND ELLE ARRIVE, indépendamment des
// autres. Une annonce « Saisons 1, 2 » dont seule la 1 est réellement en
// bibliothèque → push « Saison 1 est sortie » tout de suite, puis « Saison 2
// est sortie » quand elle atterrit (la ligne reste différée jusqu'à avoir
// honoré TOUTES les saisons). L'annonce groupée d'origine n'est poussée telle
// quelle que si TOUT est vrai d'un coup. Ne jamais mentir, jamais re-notifier :
// l'état d'avancement vit dans announced_contents (clés par saison) — aucune
// table nouvelle, aucun couplage au plugin (sa ligne en cloche reste intacte).

export interface PushPlan {
  /** skip = tout déjà annoncé (enrichir les alias + marquer pushedAt) ;
   *  defer = rien de vrai à pousser (ne PAS marquer, re-tenter au tick suivant) ;
   *  push  = envoyer body, enregistrer keys, marquer seulement si complete. */
  action: "skip" | "defer" | "push";
  body: string;
  keys: string[];
  /** push : true = annonce entièrement honorée → marquer pushedAt ;
   *  false = il reste des saisons manquantes → la ligne reste différée. */
  complete: boolean;
}

/** Corps par saisons, mot pour mot le format du plugin (releasedSuffix féminin). */
function composeSeasonsBody(seasons: number[]): string {
  const sorted = [...seasons].sort((a, b) => a - b);
  const multi = sorted.length > 1;
  const label = multi ? `Saisons ${sorted.join(", ")}` : `Saison ${sorted[0]}`;
  return `${label} ${multi ? "sont sorties" : "est sortie"} sur Tentacle TV`;
}

/**
 * Décision complète pour une notification Seer. null si la notif n'est pas une
 * annonce de disponibilité (l'appelant garde son chemin générique).
 */
export async function planSeerAvailabilityPush(
  n: { jellyfinUserId: string; type: string; title: string; body: string | null; refId: string | null },
  userClaims: RegistryClaim[],
): Promise<PushPlan | null> {
  const avail = parseSeerAvailability(n);
  if (!avail) return null;
  const resolved = await resolveSeerContent(n, userClaims);
  const exact = exactPushKey(n);
  const original = n.body ?? "";

  // ——— Film ou série sans détail de saison : unité indivisible ———
  if (avail.seasons.length === 0) {
    const dedupClaims = resolved ? [resolved, ...userClaims] : userClaims;
    const keys = [exact, ...seerContentKeys(n, dedupClaims)];
    if (await isAnnounced(n.jellyfinUserId, keys)) {
      return { action: "skip", body: original, keys, complete: true };
    }
    if ((await checkJellyfinPresence(resolved)) === "absent") {
      return { action: "defer", body: original, keys: [], complete: false };
    }
    return { action: "push", body: original, keys, complete: true };
  }

  // ——— Annonce par saisons : chaque saison vit sa vie ———
  const tv = resolved?.mediaType === "tv" ? resolved : null;
  const keysOf = (s: number): string[] => seerSeasonKeys(tv ? tv.tmdbId : null, n.title, s);
  const flags = await filterAnnounced(n.jellyfinUserId, avail.seasons.map(keysOf));
  const remaining = avail.seasons.filter((_, i) => !flags[i]);
  const allKeys = [exact, ...avail.seasons.flatMap(keysOf)];
  if (remaining.length === 0) {
    return { action: "skip", body: original, keys: allKeys, complete: true };
  }

  const presence = tv ? await checkSeasonsPresence(tv, remaining) : "unknown";
  if (presence === "unknown") {
    // Invérifiable (contenu non résolu ou panne Jellyfin) → fail-open sur le
    // restant : annoncer plutôt que risquer d'avaler une notif légitime.
    const body = remaining.length === avail.seasons.length ? original : composeSeasonsBody(remaining);
    return { action: "push", body, keys: allKeys, complete: true };
  }
  const present = remaining.filter((s) => presence.has(s));
  const missing = remaining.filter((s) => !presence.has(s));
  if (present.length === 0) {
    return { action: "defer", body: original, keys: [], complete: false };
  }
  const complete = missing.length === 0;
  const body = present.length === avail.seasons.length ? original : composeSeasonsBody(present);
  // exactPushKey seulement quand l'annonce est entièrement honorée : une ligne
  // recréée à l'identique (flapping plugin) doit encore pouvoir livrer les
  // saisons restantes — la dédup par saison, elle, est déjà posée.
  const keys = [...present.flatMap(keysOf), ...(complete ? [exact] : [])];
  return { action: "push", body, keys, complete };
}
