import { getPrisma, hasPrisma } from "../db";
import { parseAnchors } from "../reco/anchorStore";
import type { AnchorKind } from "../reco/anchors";
import { getCachedMetaMany, metaKey } from "../tmdb/metaCache";
import type { ViewingStatsSignals, ViewingStatsTaste, ViewingStatsTasteReason, ViewingStatsTasteTitle } from "./contract";
import type { JudgmentCounts } from "./judgments";

/**
 * Le goût, lu dans le profil du moteur de recommandations — TEL QUEL : aucun
 * recalcul, aucune reconstruction déclenchée d'ici. Un profil absent (moteur
 * pas encore passé, personnalisation coupée) donne `available: false`, et la
 * page le dit au lieu d'inventer.
 */

export const LOVED_MAX = 10;

/** Les signaux qui disent « aimé », du plus parlant au plus discret. */
const REASONS: Array<[AnchorKind, ViewingStatsTasteReason]> = [
  ["superlike", "superlike"],
  ["favorite", "favorite"],
  ["rating", "rating"],
  ["like", "like"],
  ["swipe_like", "like"],
  ["rewatch", "rewatch"],
  ["series", "series"],
  ["completed", "completed"],
];

function reasonsOf(kinds: readonly AnchorKind[]): ViewingStatsTasteReason[] {
  const out: ViewingStatsTasteReason[] = [];
  for (const [kind, reason] of REASONS) if (kinds.includes(kind) && !out.includes(reason)) out.push(reason);
  return out;
}

/** Un titre de bibliothèque retrouvé : son id Jellyfin et son nom. */
export interface LibraryTitle {
  id: string;
  name: string;
}

/**
 * @param counts          « Vos avis », tirés des jugements du calcul
 * @param ratings         note moyenne par titre (« movie:603 » → 8,5)
 * @param libraryTitleOf  pont « movie:603 » / « tv:1399 » / « jf:<id> » →
 *                        titre de bibliothèque, bâti depuis l'historique et
 *                        les favoris (sans appel de plus)
 */
export async function readTaste(
  userId: string,
  counts: JudgmentCounts & { favorites: number },
  ratings: ReadonlyMap<string, number>,
  libraryTitleOf: (key: string) => LibraryTitle | null
): Promise<ViewingStatsTaste> {
  const signals: ViewingStatsSignals = { ...counts };
  if (!hasPrisma()) return { available: false, computedAt: null, animeShare: 0, loved: [], signals };
  const profile = await getPrisma().tasteProfile.findUnique({
    where: { jellyfinUserId: userId },
    select: { anchors: true, animeShare: true, computedAt: true },
  });

  const anchors = profile ? parseAnchors(profile.anchors) ?? [] : [];
  const lovedAnchors = anchors
    .filter((a) => a.weight > 0 && reasonsOf(a.kinds).length > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, LOVED_MAX);
  const metas = await getCachedMetaMany(
    lovedAnchors.filter((a) => a.tmdbId > 0).map((a) => ({ mediaType: a.mediaType, tmdbId: a.tmdbId }))
  );

  const loved: ViewingStatsTasteTitle[] = lovedAnchors.map((a) => {
    const meta = a.tmdbId > 0 ? metas.get(metaKey(a.mediaType, a.tmdbId)) : undefined;
    const library = libraryTitleOf(a.key);
    return {
      key: a.key,
      mediaType: a.mediaType,
      tmdbId: a.tmdbId,
      title: a.title || meta?.title || library?.name || "",
      jellyfinId: library?.id ?? (a.key.startsWith("jf:") ? a.key.slice(3) : null),
      posterPath: meta?.posterPath ?? null,
      reasons: reasonsOf(a.kinds),
      rating: ratings.get(a.key) ?? null,
      hours: a.hours,
    };
  });

  return {
    available: !!profile,
    computedAt: profile ? profile.computedAt.toISOString() : null,
    animeShare: profile?.animeShare ?? 0,
    // Un titre sans nom ne se montre pas : une affiche muette n'apprend rien.
    loved: loved.filter((l) => l.title !== ""),
    signals,
  };
}
