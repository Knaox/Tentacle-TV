import { getPrisma } from "../db";
import { canonicalKey } from "./candidates/exclusions";
import { pokePage } from "./pageJobs";

/**
 * Un titre DEMANDÉ (à une extension de demandes) sort des recommandations du
 * compte qui l'a demandé — tout de suite, et pour lui seul. Ce n'est PAS un
 * jugement : ni goût, ni ancre, ni statistique ; il est seulement masqué.
 *
 * Rangé dans `recommendation_feedback`, action « requested » : la table que
 * les exclusions relisent déjà à chaque page servie (`accountExclusionKeys`),
 * et que les ancres ignorent pour toute action qu'elles ne connaissent pas
 * (`anchors.ts`, refus explicites : seuls « not_interested » et « dismissed »
 * pèsent). Aucun schéma à changer.
 *
 * L'extension le dit par son contexte (`ctx.recommendations.titleRequested`,
 * pluginBackendLoader.ts) : c'est elle qui sait qu'une demande est passée,
 * d'où qu'elle vienne — carte de Tentacle ou page de l'extension.
 */
export const REQUESTED_ACTION = "requested";

export interface RequestedTitle {
  mediaType: string;
  tmdbId: number;
}

/** La clé d'un titre demandé, ou `null` : le titre n'en est pas un. */
export function requestedTitleKey(title: RequestedTitle): string | null {
  const { mediaType, tmdbId } = title;
  if (!["movie", "tv", "series"].includes(mediaType)) return null;
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return null;
  return canonicalKey(mediaType, tmdbId);
}

/**
 * Masque le titre pour le compte. N'écrase JAMAIS un refus déjà posé (« ne
 * plus me proposer » pèse sur le goût : il doit le garder). Idempotent.
 */
export async function hideRequestedTitle(userId: string, title: RequestedTitle): Promise<boolean> {
  const itemKey = requestedTitleKey(title);
  if (!userId || !itemKey) return false;
  // Un retour déjà posé (quel qu'il soit) reste tel quel : SQLite n'a pas
  // `skipDuplicates`, on regarde avant, dans la même transaction.
  const count = await getPrisma().$transaction(async (tx) => {
    const known = await tx.recommendationFeedback.findUnique({
      where: { jellyfinUserId_itemKey: { jellyfinUserId: userId, itemKey } },
      select: { id: true },
    });
    if (known) return 0;
    await tx.recommendationFeedback.create({ data: { jellyfinUserId: userId, itemKey, action: REQUESTED_ACTION } });
    return 1;
  });
  // L'exclusion vaut dès la page suivante ; la reconstruction recomble la place.
  if (count > 0) pokePage(userId, "feedback");
  return count > 0;
}

/** Les titres que le compte a demandés — les clients les retirent de ce qu'ils tiennent déjà. */
export async function requestedTitleKeys(userId: string): Promise<string[]> {
  const rows = await getPrisma().recommendationFeedback.findMany({
    where: { jellyfinUserId: userId, action: REQUESTED_ACTION },
    select: { itemKey: true },
  });
  return rows.map((r) => r.itemKey);
}
