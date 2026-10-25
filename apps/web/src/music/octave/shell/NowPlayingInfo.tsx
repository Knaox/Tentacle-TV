/**
 * Octave — pochette, titre, artistes et cœur du titre en cours, et un message
 * court si le son ne vient pas. Un titre qui ne peut pas être lu RESTE affiché,
 * avec « Réessayer » à côté du message (Damien, 25/10 : jamais sauté au suivant) ;
 * pendant le nouvel essai, le bouton s'efface et « Lecture dans un instant… »
 * paraît si la source tarde.
 * Mis à jour AU CLIC (instantané synchrone du lecteur).
 *
 * Avec `onOpen` (le dock du bureau), la pochette ouvre le lecteur « en cours ».
 */

import { memo } from "react";
import { Maximize2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTrackActions } from "../actions/useTrackActions";
import { Artwork } from "../components/Artwork";
import { HeartButton } from "../components/HeartButton";
import { TrackMenu } from "../components/TrackMenu";
import { octavePaths } from "../octavePaths";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer, usePlayerSelector } from "../player/OctavePlayerProvider";

interface NowPlayingInfoProps {
  artworkClass?: string;
  onOpen?: () => void;
}

export const NowPlayingInfo = memo(function NowPlayingInfo({ artworkClass = "h-14 w-14", onOpen }: NowPlayingInfoProps) {
  const { t } = useTranslation("music");
  const track = usePlayerSelector((s) => s.current);
  const error = usePlayerSelector((s) => s.error);
  const notice = usePlayerSelector((s) => s.notice);
  const actions = useTrackActions();
  const player = useOctavePlayer();
  if (!track) {
    return <p className="truncate px-2 text-sm text-content-tertiary">{t("player.nothing")}</p>;
  }
  const albumId = track.album?.jellyfinId;
  const artwork = <Artwork url={track.artworkUrl} alt={track.album?.title ?? track.title} className={`${artworkClass} shadow-[var(--oc-shadow-art)]`} eager />;
  return (
    <div className="flex min-w-0 items-center gap-3" data-octave-now-playing={track.key}>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("player.open")}
          title={t("player.open")}
          className="octave-art-open relative shrink-0 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {artwork}
          <span aria-hidden className="octave-art-open-hint absolute inset-0 flex items-center justify-center rounded-md bg-black/45 text-white">
            <Maximize2 className="h-4 w-4" />
          </span>
        </button>
      ) : (
        artwork
      )}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {albumId ? (
            <Link to={octavePaths.album(albumId)} className="truncate text-sm font-semibold text-content-primary hover:underline">
              {track.title}
            </Link>
          ) : (
            <span className="truncate text-sm font-semibold text-content-primary">{track.title}</span>
          )}
        </div>
        <p className="flex min-w-0 items-center gap-2 text-[13px] text-content-tertiary">
          {error ? (
            <>
              <span className="truncate text-status-error-fg" role="status">
                {t(error === "noSource" ? "player.noSource" : "player.engineError")}
              </span>
              {/* La zone de clic dépasse la ligne (24 px au moins, WCAG 2.5.8) sans la faire bouger. */}
              <button
                type="button"
                onClick={() => queueActions.retry(player)}
                className="relative shrink-0 cursor-pointer rounded-full px-1.5 font-semibold text-octave-accent-text underline-offset-2 transition-colors duration-150 before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                {t("player.retry")}
              </button>
            </>
          ) : notice === "retrySoon" ? (
            <span role="status">{t("player.retrySoon")}</span>
          ) : (
            <span className="truncate">{track.artists.map((a) => a.name).join(", ")}</span>
          )}
        </p>
      </div>
      <HeartButton track={track} actions={actions} />
      {/* Le titre EN COURS s'ajoute à une playlist, ou s'en retire, sans quitter le lecteur (25/10). */}
      <TrackMenu track={track} actions={actions} visible="always" />
    </div>
  );
});
