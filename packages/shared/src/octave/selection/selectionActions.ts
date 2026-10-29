/**
 * Octave — les GESTES d'une sélection de titres, décrits une fois pour tous les clients (web, bureau, mobile) :
 * lesquels s'offrent, dans quel ordre, sous quels mots. Chaque client ne fait que les RENDRE (barre du bureau,
 * barre du mobile) et les brancher ; aucun ne recopie la liste ni ses conditions.
 *
 * Ordre : la playlist d'abord (le geste demandé), puis la file (« Lire ensuite », « Ajouter à la file d'attente »),
 * le cœur, et en dernier « Retirer » — destructif, séparé des autres.
 */

export type SelectionActionId = "addToPlaylist" | "playNext" | "enqueue" | "like" | "unlike" | "remove";

export interface SelectionActionContext {
  /** Titres choisis. Aucun : aucun geste (la barre dit seulement « Sélectionnez des titres »). */
  count: number;
  /** Au moins un titre choisi peut entrer dans une playlist (bibliothèque, ou extension qui sait l'ajouter). */
  canAddToPlaylist: boolean;
  /** Un lecteur est là pour la file ; `inQueue` : la liste EST la file (s'y ajouter n'a pas de sens). */
  canQueue: boolean;
  inQueue?: boolean;
  /** Le cœur : `null` quand aucun titre choisi ne s'aime ; sinon ce que le geste fera (aimer, ou retirer des likés). */
  like: { liked: boolean } | null;
  /** « Retirer d'ici » : une playlist à soi (ou que le compte peut modifier), la file. */
  canRemove: boolean;
}

export function selectionActions(ctx: SelectionActionContext): SelectionActionId[] {
  if (ctx.count === 0) return [];
  const out: SelectionActionId[] = [];
  if (ctx.canAddToPlaylist) out.push("addToPlaylist");
  if (ctx.canQueue && !ctx.inQueue) out.push("playNext", "enqueue");
  if (ctx.like) out.push(ctx.like.liked ? "like" : "unlike");
  if (ctx.canRemove) out.push("remove");
  return out;
}

/** Les mots de chaque geste (espace i18n `music`) : les mêmes partout. */
export const SELECTION_ACTION_LABEL: Readonly<Record<SelectionActionId, string>> = {
  addToPlaylist: "playlist.addTo",
  playNext: "track.playNext",
  enqueue: "track.addToQueue",
  like: "selection.like",
  unlike: "selection.unlike",
  remove: "playlist.remove",
};

/** Le geste destructif : rendu à part (couleur de danger, séparé). */
export const isDestructiveSelectionAction = (id: SelectionActionId): boolean => id === "remove";
