/**
 * Octave — sur le rail, une playlist partagée porte le pictogramme « personnes » après son nom (le nom de qui y a
 * accès dans son libellé). Rien sans partage ni capacité.
 */

import { memo } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlaylistSharingRules } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";

export const SharedRailMark = memo(function SharedRailMark({ playlist }: { playlist: MusicPlaylist }) {
  const { t } = useTranslation("musicPlaylistMembers");
  const rules = usePlaylistSharingRules(playlist);
  if (!rules.isShared) return null;
  const label = t("sharedWith", { names: rules.people.map((p) => p.name).join(", ") });
  return (
    <span role="img" aria-label={label} title={label} className="ml-auto shrink-0 text-content-tertiary">
      <Users className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
});
