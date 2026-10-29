/**
 * Octave — le MENU d'actions d'un album, d'un artiste ou d'une playlist (clic
 * droit, appui long, « … »), décrit une fois pour toutes les plateformes : le
 * web et le bureau le rendent en menu, le mobile en feuille. Pur : chaque vue
 * traduit l'identifiant (espace i18n `musicFavorites` › `actions.<id>`) et
 * branche le geste.
 *
 * Ordre fixe, par groupes (un séparateur entre deux groupes) :
 *   1. `favorite` — Ajouter aux favoris / Retirer des favoris ;
 *   2. `moveTop`, `reorder` — l'ordre de la rubrique (là où il existe) ;
 *   3. `edit`, `duplicate`, `shareWith`, `shareLink`, `members` — la playlist ;
 *   4. `delete` (propriétaire) ou `leave` (playlist reçue), en rouge.
 * Rien ne s'offre que le serveur ne sait pas faire (capacités lues par l'appelant).
 */

import { isValidExternalRef } from "../../music/musicKeys";
import type { ExternalRef } from "../../music/musicTypes";

export type CollectionKind = "album" | "artist" | "playlist";

/**
 * Un élément peut-il être mis en favori ? Celui de la bibliothèque (`jellyfinId`), ou celui d'une extension qui
 * le désigne (`external` valide) — le serveur n'a rien d'autre à garder. Un album ou un artiste sans l'un ni
 * l'autre (une carte d'ailleurs, sans référence) : aucun geste de favori, nulle part (menu, cœur).
 */
export function collectionFavoritable(item: { jellyfinId: string | null; external?: ExternalRef | null }): boolean {
  if (item.jellyfinId) return true;
  return !!item.external && isValidExternalRef(item.external);
}

export type CollectionActionId =
  | "favorite"
  | "unfavorite"
  | "moveTop"
  | "reorder"
  | "edit"
  | "duplicate"
  | "shareWith"
  | "shareLink"
  | "members"
  | "leave"
  | "delete";

export type CollectionActionGroup = "favorite" | "order" | "manage" | "danger";

export interface CollectionAction {
  id: CollectionActionId;
  group: CollectionActionGroup;
  /** En rouge, et confirmé par la vue (supprimer, quitter). */
  destructive: boolean;
}

export interface CollectionActionContext {
  kind: CollectionKind;
  /** L'état du favori ; `undefined` : inconnu (serveur d'avant) — aucun geste de favori. */
  favorite: boolean | undefined;
  /** Le serveur garde-t-il ce favori ? (un élément hors bibliothèque : `music.libraryFavorites`). */
  canFavorite: boolean;
  /** Montré dans une section ORDONNÉE de la bibliothèque (ses favoris, ses playlists) : l'ordre s'y règle. */
  ordered: boolean;
  /** Déjà en tête de sa section : « Mettre en haut » ne s'offre pas. */
  atTop: boolean;
  /** Plus d'un élément dans la section : « Réordonner » a un sens. */
  canReorder: boolean;
  /** Une playlist : ce que le compte peut en faire (`editable` du serveur, membre d'une playlist reçue). */
  playlist?: {
    editable: boolean;
    isMember: boolean;
    /** `music.playlistMembers` et le droit de partager. */
    canShareWith: boolean;
    /** `music.playlistShare` et le droit « Partage public ». */
    canShareLink: boolean;
  };
}

const action = (id: CollectionActionId, group: CollectionActionGroup, destructive = false): CollectionAction => ({ id, group, destructive });

export function collectionActions(ctx: CollectionActionContext): CollectionAction[] {
  const out: CollectionAction[] = [];
  if (ctx.canFavorite && ctx.favorite !== undefined) out.push(action(ctx.favorite ? "unfavorite" : "favorite", "favorite"));
  if (ctx.ordered && !ctx.atTop) out.push(action("moveTop", "order"));
  if (ctx.ordered && ctx.canReorder) out.push(action("reorder", "order"));
  const p = ctx.kind === "playlist" ? ctx.playlist : undefined;
  if (p?.isMember) {
    out.push(action("members", "manage"));
    out.push(action("leave", "danger", true));
  } else if (p?.editable) {
    out.push(action("edit", "manage"));
    out.push(action("duplicate", "manage"));
    if (p.canShareWith) out.push(action("shareWith", "manage"));
    if (p.canShareLink) out.push(action("shareLink", "manage"));
    out.push(action("delete", "danger", true));
  }
  return out;
}

/** Les actions en groupes, dans l'ordre : la vue pose un séparateur entre deux groupes. */
export function groupCollectionActions(actions: readonly CollectionAction[]): CollectionAction[][] {
  const groups: CollectionAction[][] = [];
  for (const a of actions) {
    const last = groups[groups.length - 1];
    if (last && last[0]!.group === a.group) last.push(a);
    else groups.push([a]);
  }
  return groups;
}

/** La clé i18n d'une action (espace `musicFavorites`). */
export function collectionActionLabelKey(id: CollectionActionId): `actions.${CollectionActionId}` {
  return `actions.${id}`;
}
