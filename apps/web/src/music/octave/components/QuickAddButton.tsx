/**
 * Octave — le « + » d'un titre : d'un geste dans la DERNIÈRE playlist utilisée (l'avis dit laquelle, avec
 * « Changer ») ; sans playlist connue, il ouvre le choix (« Nouvelle playlist… » compris). Un doublon demande
 * confirmation, comme tout ajout. Le nom accessible dit la cible (« Ajouter à « Soirée » »).
 */

import { memo } from "react";
import { ListPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMusicPlaylists } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { TrackActions } from "../actions/useTrackActions";
import { lastPlaylistId, quickTarget } from "../actions/lastPlaylist";

const HOVER_CLASS = "octave-hover-reveal opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100";

export const QuickAddButton = memo(function QuickAddButton({ track, actions, visible = "hover", className = "h-8 w-8 text-content-tertiary" }: {
  track: MusicTrack;
  actions: TrackActions;
  visible?: "hover" | "always";
  className?: string;
}) {
  const { t } = useTranslation("music");
  const playlists = useMusicPlaylists();
  if (!actions.canAddToPlaylist(track)) return null;
  const target = quickTarget(playlists.data ?? [], lastPlaylistId());
  const label = target ? t("playlist.quickAdd", { name: target.name }) : t("playlist.addTo");
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        void actions.quickAdd(track);
      }}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className} ${visible === "hover" ? HOVER_CLASS : ""}`}
    >
      <ListPlus className="h-4 w-4" aria-hidden />
    </button>
  );
});
