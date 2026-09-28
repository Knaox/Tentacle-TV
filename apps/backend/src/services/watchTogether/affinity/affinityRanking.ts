import type { LibraryEntry, LibraryIndex } from "../../reco/candidates/libraryIndex";
import { libraryCard } from "../../swipe/poolCards";
import type { WtAffinityKind } from "../protocol";
import { kindOf } from "./affinityKinds";
import type { AffinityCard } from "./affinityTypes";

/**
 * Affinité — la pile commune et son ordre, en logique pure.
 *
 * La pile : les titres de bibliothèque que TOUS les membres de la salle
 * peuvent lire (l'intersection de leurs bibliothèques, droits Jellyfin
 * compris), avec une affiche, sauf ceux que tous ont déjà vus. Jamais un
 * titre hors bibliothèque, jamais Vigie.
 *
 * L'ordre : le goût COMMUN. Chaque membre donne à chaque titre une affinité
 * de 0 à 1, tirée de ce que Tentacle sait déjà de lui — Ma liste, favoris,
 * verdicts d'« Affiner », rang dans son pool de recommandations. Le titre
 * vaut la moyenne, moins une part de l'écart entre le plus chaud et le plus
 * froid : un titre qui plaît moyennement à tous passe devant un titre qui
 * enthousiasme l'un et rebute l'autre. Un peu de hasard, propre à la séance,
 * évite de rejouer toujours la même pile. Lecture seule : rien de ce qui se
 * vote ici ne remonte dans ces profils.
 */

export interface MemberTaste {
  userId: string;
  library: LibraryIndex;
  /** Rang dans le pool classé du compte : 1 en tête, 0 en queue. */
  poolRank: ReadonlyMap<string, number>;
  /** Verdicts d'« Affiner » du compte, par clé de titre. */
  swipes: ReadonlyMap<string, string>;
}

/** Part de l'écart (plus chaud − plus froid) retranchée à la moyenne. */
const DISAGREEMENT_WEIGHT = 0.35;
/** La note communautaire départage les titres que rien ne distingue. */
const RATING_WEIGHT = 0.05;
/** Le hasard de la séance : assez pour renouveler, trop peu pour renverser. */
const JITTER_WEIGHT = 0.12;

/** Ce qu'un membre pense a priori d'un titre, de 0 (non) à 1 (oui). */
export function memberAffinity(member: MemberTaste, key: string): number {
  const entry = member.library.byKey.get(key);
  const verdict = member.swipes.get(key);
  if (verdict === "dislike") return 0.05;
  if (verdict === "superlike") return 0.97;
  if (entry?.inWatchlist) return 0.95;
  if (verdict === "like") return 0.9;
  if (entry?.isFavorite) return 0.85;
  // Une série qu'il a entamée seul : la reprendre en groupe l'obligerait à
  // revoir ou à sauter des épisodes.
  if (entry?.inProgress) return 0.3;
  const rank = member.poolRank.get(key);
  if (rank !== undefined) return 0.3 + 0.6 * rank;
  if (entry?.played) return 0.2;
  return 0.4;
}

/** Les titres que tous les membres voient, avec affiche, que tous n'ont pas vus. */
export function sharedEntries(members: readonly MemberTaste[]): LibraryEntry[] {
  if (members.length === 0) return [];
  const [first, ...others] = members;
  return first.library.entries.filter((entry) => {
    if (!entry.hasPrimaryImage) return false;
    let seenByAll = entry.played;
    for (const member of others) {
      const theirs = member.library.byKey.get(entry.key);
      if (!theirs) return false;
      seenByAll = seenByAll && theirs.played;
    }
    return !seenByAll;
  });
}

/** Un nombre stable de [0, 1) tiré d'un texte (FNV-1a). */
export function hashUnit(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

export function groupScore(members: readonly MemberTaste[], entry: LibraryEntry, seed: string): number {
  const scores = members.map((member) => memberAffinity(member, entry.key));
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const spread = Math.max(...scores) - Math.min(...scores);
  const rating = (entry.communityRating ?? 6) / 10;
  return mean - DISAGREEMENT_WEIGHT * spread + RATING_WEIGHT * rating + JITTER_WEIGHT * hashUnit(`${seed}|${entry.key}`);
}

/** La pile d'une séance : les titres du type choisi, du goût commun le plus
 *  sûr au moins sûr, `max` au plus. */
export function rankCatalog(input: {
  members: readonly MemberTaste[];
  entries: readonly LibraryEntry[];
  kind: WtAffinityKind;
  animeKeys: ReadonlySet<string>;
  seed: string;
  max: number;
}): AffinityCard[] {
  return input.entries
    .filter((entry) => kindOf(entry, input.animeKeys) === input.kind)
    .map((entry) => ({ entry, score: groupScore(input.members, entry, input.seed) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, input.max)
    .map(({ entry }) => ({ ...libraryCard(entry, "taste"), jellyfinItemId: entry.itemId }));
}
