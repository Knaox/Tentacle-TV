/**
 * Octave — « Ajouter tous les titres à une playlist » (en-tête d'un album, d'une playlist) : le choix de playlist
 * des titres groupés (`openPlaylistChooserForMany`), qui garde l'ordre et applique la règle de doublon groupée
 * (« 2 des 11 titres sont déjà dans X » : tout, sans les doublons, ou rien). Rien si aucun titre ne peut y entrer.
 */

import { ListPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { openPlaylistChooserForMany } from "./playlistChooserStore";
import { useTrackActions } from "./useTrackActions";

export function AddAllToPlaylistButton({ tracks, className = "" }: { tracks: readonly MusicTrack[]; className?: string }) {
  const { t } = useTranslation("music");
  const actions = useTrackActions();
  const able = tracks.filter(actions.canAddToPlaylist);
  if (able.length === 0) return null;
  const label = t("selection.addAll");
  return (
    <button
      type="button"
      onClick={() => openPlaylistChooserForMany(able)}
      aria-label={label}
      title={label}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full text-content-secondary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${className}`}
    >
      <ListPlus className="h-5 w-5" aria-hidden />
    </button>
  );
}
