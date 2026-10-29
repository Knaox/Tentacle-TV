/**
 * Octave — l'en-tête d'une playlist partagée dit À QUI elle est : la pile d'avatars et, en mots, « Partagée par
 * X · vous pouvez y ajouter des titres » (un membre) ou « Partagée avec A, B » (le propriétaire). Le tout est un
 * bouton (44 px de haut) qui ouvre la feuille des personnes. Rien sans partage ni capacité.
 */

import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlaylistSharingRules } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { requestPlaylistManage } from "../playlistManageStore";
import { PeopleStack } from "./PeopleStack";

export function SharedPlaylistLine({ playlist }: { playlist: MusicPlaylist }) {
  const { t } = useTranslation("musicPlaylistMembers");
  const rules = usePlaylistSharingRules(playlist);
  const sharing = rules.sharing;
  if (!rules.isShared || !sharing) return null;
  const text =
    sharing.role === "member"
      ? `${t("sharedBy", { name: sharing.owner.name })} · ${t(`yourRight.${sharing.right === "owner" ? "remove" : sharing.right}`)}`
      : t("sharedWith", { names: rules.people.map((p) => p.name).join(", ") });
  return (
    <button
      type="button"
      onClick={() => requestPlaylistManage({ kind: "members", playlist })}
      className="-my-2 inline-flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full px-1 text-left text-content-secondary transition-colors hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <Users className="h-4 w-4 shrink-0 text-[var(--brand)]" aria-hidden />
      <PeopleStack people={rules.people} size={22} max={4} />
      <span className="truncate">{text}</span>
    </button>
  );
}
