import type { MediaItem, WtAffinityMatchDto } from "@tentacle-tv/shared";
import { launchAffinityMatch } from "../affinityApi";
import { closeAffinity } from "./affinityStore";

/** Où aller après « Regarder ensemble » : le lecteur, sinon la fiche. */
export type AffinityLaunchTarget = { itemId: string } | { detailId: string };

/**
 * « Regarder ensemble », sans routeur — chaque client navigue lui-même.
 *
 * Le serveur d'abord : il referme la séance chez tous, et ceux qui swipaient
 * suivront ; puis lancer comme partout ailleurs — arriver sur le lecteur d'un
 * autre média le lance pour le groupe (`wt:setItem`). Une série se lit à
 * l'épisode à reprendre de celui qui lance ; terminée, sa fiche.
 *
 * Le serveur refuse (code `answered`) si quelqu'un a répondu avant : rien ne
 * part alors, l'erreur remonte à l'appelant — sinon deux membres pourraient
 * partir chacun de leur côté.
 */
export async function launchAffinityMatchFor(
  match: WtAffinityMatchDto,
  resolvePlayTarget: (item: MediaItem) => Promise<string | null>,
): Promise<AffinityLaunchTarget> {
  await launchAffinityMatch(match.key);
  const item = { Id: match.itemId, Type: match.mediaType === "tv" ? "Series" : "Movie" } as MediaItem;
  const target = await resolvePlayTarget(item).catch(() => null);
  closeAffinity();
  return target ? { itemId: target } : { detailId: match.itemId };
}
