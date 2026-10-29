/**
 * Octave — le libellé et l'icône de chaque action du menu partagé (`collectionActions`) sur le web et le bureau.
 * Les gestes d'une playlist gardent les mots qu'ils avaient (espaces `music`, `musicShare`,
 * `musicPlaylistMembers`) ; le favori et l'ordre viennent de `musicFavorites`.
 */

import { ArrowUpDown, ArrowUpToLine, Copy, Heart, HeartOff, Link2, LogOut, Pencil, Trash2, Users, type LucideIcon } from "lucide-react";
import type { CollectionActionId } from "@tentacle-tv/shared/octave";

export interface CollectionActionLabel {
  ns: "music" | "musicShare" | "musicPlaylistMembers" | "musicFavorites";
  key: string;
  icon: LucideIcon;
}

export const COLLECTION_ACTION_LABELS: Record<CollectionActionId, CollectionActionLabel> = {
  favorite: { ns: "musicFavorites", key: "actions.favorite", icon: Heart },
  unfavorite: { ns: "musicFavorites", key: "actions.unfavorite", icon: HeartOff },
  moveTop: { ns: "musicFavorites", key: "actions.moveTop", icon: ArrowUpToLine },
  reorder: { ns: "musicFavorites", key: "actions.reorder", icon: ArrowUpDown },
  edit: { ns: "music", key: "playlistManage.editDetails", icon: Pencil },
  duplicate: { ns: "music", key: "playlistManage.duplicate", icon: Copy },
  shareWith: { ns: "musicPlaylistMembers", key: "shareWith", icon: Users },
  shareLink: { ns: "musicShare", key: "action", icon: Link2 },
  members: { ns: "musicPlaylistMembers", key: "people", icon: Users },
  leave: { ns: "musicPlaylistMembers", key: "leave", icon: LogOut },
  delete: { ns: "music", key: "playlistManage.delete", icon: Trash2 },
};
