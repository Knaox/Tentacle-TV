/**
 * Octave — le libellé et l'icône de chaque action du menu partagé (`collectionActions`) sur le web et le bureau.
 * Les gestes d'une playlist gardent les mots qu'ils avaient (espaces `music`, `musicShare`,
 * `musicPlaylistMembers`) ; le favori et l'ordre viennent de `musicFavorites`.
 */

import { ArrowsDownUpIcon as ArrowUpDown } from "@phosphor-icons/react/dist/csr/ArrowsDownUp";
import { ArrowLineUpIcon as ArrowUpToLine } from "@phosphor-icons/react/dist/csr/ArrowLineUp";
import { CopyIcon as Copy } from "@phosphor-icons/react/dist/csr/Copy";
import { HeartIcon as Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { HeartBreakIcon as HeartOff } from "@phosphor-icons/react/dist/csr/HeartBreak";
import { LinkIcon as Link2 } from "@phosphor-icons/react/dist/csr/Link";
import { SignOutIcon as LogOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { PencilSimpleIcon as Pencil } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { TrashIcon as Trash2 } from "@phosphor-icons/react/dist/csr/Trash";
import { UsersIcon as Users } from "@phosphor-icons/react/dist/csr/Users";
import type { Icon as IconType } from "@phosphor-icons/react";
import type { CollectionActionId } from "@tentacle-tv/shared/octave";

export interface CollectionActionLabel {
  ns: "music" | "musicShare" | "musicPlaylistMembers" | "musicFavorites";
  key: string;
  icon: IconType;
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
