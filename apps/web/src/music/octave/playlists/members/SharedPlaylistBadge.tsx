/**
 * Octave — le LOGO d'une playlist partagée, posé sur sa jaquette (cartes) : une pastille d'encre au coin bas
 * gauche, le pictogramme « personnes » au dégradé de marque et la pile des avatars de qui y a accès. Les noms :
 * au survol (`title`) ET dans le libellé accessible — jamais au survol seulement. Rien sans partage ni capacité.
 */

import { memo } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlaylistSharingRules } from "@tentacle-tv/api-client";
import type { MusicPlaylist } from "@tentacle-tv/shared/music";
import { PeopleStack } from "./PeopleStack";

export const SharedPlaylistBadge = memo(function SharedPlaylistBadge({ playlist }: { playlist: MusicPlaylist }) {
  const { t } = useTranslation("musicPlaylistMembers");
  const rules = usePlaylistSharingRules(playlist);
  if (!rules.isShared) return null;
  const names = rules.people.map((p) => p.name).join(", ");
  const label = t("sharedWith", { names });
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="pointer-events-auto absolute bottom-2 left-2 z-[1] inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-1"
      // Une encre opaque : aucun flou derrière (règles « Coût GPU »), lisible sur toute pochette.
      style={{ background: "color-mix(in srgb, var(--oc-ink, #0d0b13) 88%, transparent)" }}
    >
      <span className="octave-brand-fill flex h-[22px] w-[22px] items-center justify-center rounded-full">
        <Users className="h-3 w-3" aria-hidden />
      </span>
      <PeopleStack people={rules.people} size={22} max={3} />
    </span>
  );
});
