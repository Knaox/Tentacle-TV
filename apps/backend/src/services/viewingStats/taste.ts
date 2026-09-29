import { getPrisma, hasPrisma } from "../db";
import { parseAnchors, parsePotentials } from "../reco/anchorStore";
import type { AnchorKind } from "../reco/anchors";
import { getCachedMetaMany, metaKey } from "../tmdb/metaCache";
import type {
  ViewingStatsPotentialTitle, ViewingStatsSignals, ViewingStatsTaste, ViewingStatsTasteReason, ViewingStatsTasteTitle,
} from "./contract";
import type { JudgmentCounts } from "./judgments";

/**
 * Le goût, lu dans le profil du moteur de recommandations — TEL QUEL : aucun
 * recalcul, aucune reconstruction déclenchée d'ici. Un profil absent (moteur
 * pas encore passé, personnalisation coupée) donne `available: false`, et la
 * page le dit au lieu d'inventer.
 */

export const LOVED_MAX = 10;
/** « À voir » : quelques affiches suffisent, le compte dit le reste. */
export const POTENTIAL_PREVIEW = 5;

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
  if (!hasPrisma()) return { available: false, computedAt: null, animeShare: 0, loved: [], signals, potential: null };
  const profile = await getPrisma().tasteProfile.findUnique({
    where: { jellyfinUserId: userId },
    select: { anchors: true, potentials: true, animeShare: true, computedAt: true },
  });
  // Ma liste seule : un potentiel, jamais une ancre — lu à part, montré à part (reco/potentials.ts).
  const potentials = profile ? parsePotentials(profile.potentials) : null;
  const preview = (potentials ?? []).slice(0, POTENTIAL_PREVIEW);

  const anchors = profile ? parseAnchors(profile.anchors) ?? [] : [];
  const lovedAnchors = anchors
    .filter((a) => a.weight > 0 && reasonsOf(a.kinds).length > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, LOVED_MAX);
  const metas = await getCachedMetaMany(
    [...lovedAnchors, ...preview].filter((a) => a.tmdbId > 0).map((a) => ({ mediaType: a.mediaType, tmdbId: a.tmdbId }))
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
    potential: potentials === null ? null : {
      count: potentials.length,
      titles: preview.map((p): ViewingStatsPotentialTitle => {
        const meta = p.tmdbId > 0 ? metas.get(metaKey(p.mediaType, p.tmdbId)) : undefined;
        return {
          key: p.key, mediaType: p.mediaType, tmdbId: p.tmdbId, title: p.title || meta?.title || "",
          jellyfinId: p.jellyfinId, posterPath: meta?.posterPath ?? null,
        };
      }),
    },
  };
}
