/**
 * Octave — pochette, titre, artistes et cœur du titre en cours, et un message
 * court si le son ne vient pas.
 * Mis à jour AU CLIC (instantané synchrone du lecteur).
 */

import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTrackActions } from "../actions/useTrackActions";
import { Artwork } from "../components/Artwork";
import { HeartButton } from "../components/HeartButton";
import { octavePaths } from "../octavePaths";
import { usePlayerSelector } from "../player/OctavePlayerProvider";

export const NowPlayingInfo = memo(function NowPlayingInfo({ artworkClass = "h-14 w-14" }: { artworkClass?: string }) {
  const { t } = useTranslation("music");
  const track = usePlayerSelector((s) => s.current);
  const error = usePlayerSelector((s) => s.error);
  const notice = usePlayerSelector((s) => s.notice);
  const actions = useTrackActions();
  if (!track) {
    return <p className="truncate px-2 text-sm text-content-tertiary">{t("player.nothing")}</p>;
  }
  const albumId = track.album?.jellyfinId;
  return (
    <div className="flex min-w-0 items-center gap-3" data-octave-now-playing={track.key}>
      <Artwork url={track.artworkUrl} alt={track.album?.title ?? track.title} className={`${artworkClass} shadow-md`} eager />
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
        <p className="truncate text-[13px] text-content-tertiary">
          {error ? (
            <span className="text-status-error-fg" role="status">
              {t(error === "noSource" ? "player.noSource" : "player.engineError")}
            </span>
          ) : notice === "retrySoon" ? (
            <span role="status">{t("player.retrySoon")}</span>
          ) : (
            track.artists.map((a) => a.name).join(", ")
          )}
        </p>
      </div>
      <HeartButton track={track} actions={actions} />
    </div>
  );
});
