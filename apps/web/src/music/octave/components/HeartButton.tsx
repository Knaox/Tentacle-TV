/**
 * Octave — le cœur d'un titre : plein AU CLIC (le geste se pose avant la
 * réponse), caché si aucun geste n'est possible pour ce titre.
 */

import { memo } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { useLiked } from "../actions/likeOverrides";
import type { TrackActions } from "../actions/useTrackActions";

interface HeartButtonProps {
  track: MusicTrack;
  actions: TrackActions;
  size?: "sm" | "md";
  /** Visible seulement au survol de la rangée, sauf si aimé. */
  quiet?: boolean;
}

export const HeartButton = memo(function HeartButton({ track, actions, size = "sm", quiet = false }: HeartButtonProps) {
  const { t } = useTranslation("music");
  const liked = useLiked(track.key, track.favorite);
  if (!actions.canLike(track)) return <span aria-hidden className={size === "sm" ? "h-8 w-8" : "h-10 w-10"} />;
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={t(liked ? "track.unlike" : "track.like")}
      title={t(liked ? "track.unlike" : "track.like")}
      onClick={(e) => {
        e.stopPropagation();
        actions.toggleLike(track);
      }}
      className={`flex ${box} shrink-0 cursor-pointer items-center justify-center rounded-full transition-[opacity,transform] duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        liked ? "text-octave-accent-text" : `text-content-tertiary hover:text-content-primary ${quiet ? "octave-hover-reveal opacity-0 group-hover:opacity-100 focus-visible:opacity-100" : ""}`
      }`}
    >
      <Heart className={icon} fill={liked ? "currentColor" : "none"} strokeWidth={liked ? 0 : 2} />
    </button>
  );
});
