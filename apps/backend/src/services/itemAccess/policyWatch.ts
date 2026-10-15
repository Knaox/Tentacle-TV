/**
 * Un changement de politique Jellyfin se voit en 30 s au plus — qu'il vienne
 * de Tentacle ou du tableau de bord de Jellyfin (docs/DROITS-UTILISATEURS.md § 1).
 *
 * Les relevés « ce que voit un compte » (`search/userAccess.ts` : 10 min,
 * servis puis rafraîchis en fond) ignoraient la politique : un titre que
 * l'administrateur vient d'interdire restait dans les recherches et les recos
 * jusqu'au relevé suivant. La politique de contenu, elle, est relue toutes les
 * 30 s (socle, `getContentPolicy`) : son EMPREINTE comparée à la précédente dit
 * qu'elle a changé, et ce qui en dépend tombe aussitôt.
 *
 * Une écriture faite PAR TENTACLE n'attend même pas : le socle prévient
 * (`onContentPolicyInvalidated`, identifiant normalisé ou `null` = tous) et
 * tout ce qui dépend des droits du compte tombe sur-le-champ.
 */

import { getContentPolicy, onContentPolicyInvalidated, type ContentPolicy } from "../contentPolicy";
import { refreshLibraryMemo } from "../reco/candidates/libraryMemo";
import { pokePage } from "../reco/pageJobs";
import { forgetUserAccess } from "../search/userAccess";
import { invalidateItemVisibility } from "./itemVisibility";

const seen = new Map<string, string>();
const epochs = new Map<string, number>();

const keyOf = (userId: string) => userId.replace(/-/g, "").toLowerCase();

/** Ce qui décide de ce que voit le compte — pas les plages horaires, jugées à part. */
function fingerprint(policy: ContentPolicy): string {
  return JSON.stringify([
    policy.maxParentalRating, policy.maxParentalSubRating, policy.blockUnratedItems, policy.blockedTags,
    policy.allowedTags, policy.enableAllFolders, policy.enabledFolders, policy.blockedMediaFolders,
  ]);
}

/**
 * Vrai si la politique du compte a changé depuis la dernière fois qu'on l'a
 * regardée (la première fois : non, rien à comparer ; illisible : non, on ne
 * jette pas un relevé sur une panne). Les verdicts « titre visible » du compte
 * tombent alors avec elle.
 */
export async function policyChanged(userId: string): Promise<boolean> {
  const policy = await getContentPolicy(userId);
  if (!policy.readable) return false;
  const key = keyOf(userId);
  const next = fingerprint(policy);
  const previous = seen.get(key);
  seen.set(key, next);
  if (previous === undefined || previous === next) return false;
  invalidateItemVisibility(userId);
  epochs.set(key, (epochs.get(key) ?? 0) + 1);
  return true;
}

/** Le nombre de changements de politique vus pour ce compte : une clé de cache qui
 *  le porte se périme d'elle-même au changement suivant. */
export function policyEpoch(userId: string): number {
  return epochs.get(keyOf(userId)) ?? 0;
}

/** Ce que vide une politique invalidée par Tentacle — pour un compte, ou pour tous. */
export function dropPolicyDependents(userId: string | null): void {
  if (userId === null) {
    invalidateItemVisibility();
    forgetUserAccess();
    for (const key of seen.keys()) epochs.set(key, (epochs.get(key) ?? 0) + 1);
    return;
  }
  const key = keyOf(userId);
  invalidateItemVisibility(key);
  epochs.set(key, (epochs.get(key) ?? 0) + 1);
  forgetUserAccess(key);
  refreshLibraryMemo(key);
  pokePage(key, "settings");
}

onContentPolicyInvalidated(dropPolicyDependents);

export function resetPolicyWatchForTests(): void {
  seen.clear();
  epochs.clear();
}
