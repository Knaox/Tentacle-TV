/**
 * Octave — la boîte d'un album qui ne se lit pas (`unavailableAlbum.ts`, shared) : ouverte par sa carte grisée, elle
 * dit pourquoi (absent de YouTube) et propose de l'AIMER (action principale) ou de l'AJOUTER À UNE PLAYLIST — le
 * serveur le récupère alors (Lidarr). Elle charge l'album pour en avoir les titres ; trouvé lisible entre-temps, sa
 * vue s'ouvre à la place. Une seule boîte pour tout Octave, montée par la coquille.
 */

import { useEffect, useId, useSyncExternalStore } from "react";
import { CloudOff, Heart, ListPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  closeUnavailableAlbum, openPlaylistChooserForMany, subscribeUnavailableAlbum, unavailableAlbumSnapshot, useMusicAlbumEntity,
} from "@tentacle-tv/api-client";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { unavailableAlbumPhase, unavailableAlbumTracks } from "@tentacle-tv/shared/octave";
import { Modal } from "../../../components/ui/Modal";
import { Artwork } from "../components/Artwork";
import { useOctaveProvider } from "../mode/useOctaveProvider";
import { entityTarget, octavePaths } from "../octavePaths";
import { likeOverrideOf } from "./likeOverrides";
import { useBulkTrackActions } from "./selection/useBulkTrackActions";
import { useTrackActions } from "./useTrackActions";

const actionClass =
  "flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default disabled:opacity-50";

export function UnavailableAlbumHost() {
  const album = useSyncExternalStore(subscribeUnavailableAlbum, unavailableAlbumSnapshot, () => null);
  const target = album ? entityTarget(album) : null;
  return album && target ? <UnavailableAlbumDialog key={target} album={album} target={target} /> : null;
}

function UnavailableAlbumDialog({ album, target }: { album: MusicAlbum; target: string }) {
  const { t } = useTranslation("music");
  const titleId = useId();
  const navigate = useNavigate();
  const actions = useTrackActions();
  const bulk = useBulkTrackActions();
  // Sans aperçu : la feuille a besoin de la RÉPONSE (ses titres), jamais de ce que la carte montrait.
  const loaded = useMusicAlbumEntity(useOctaveProvider(), target);
  const phase = unavailableAlbumPhase(loaded);
  const tracks = unavailableAlbumTracks(phase, loaded.data);
  const likable = tracks.filter(actions.canLike);
  const addable = tracks.filter(actions.canAddToPlaylist);
  const allLiked = likable.length > 0 && likable.every((tr) => likeOverrideOf(tr.key) ?? tr.favorite);

  // Trouvé lisible à l'ouverture (la recherche n'en montrait qu'une partie) : sa vue, comme tout album.
  useEffect(() => {
    if (phase !== "playable") return;
    closeUnavailableAlbum();
    navigate(octavePaths.album(target));
  }, [navigate, phase, target]);

  const artists = album.artists.map((a) => a.name).join(", ");
  return (
    <Modal open onClose={closeUnavailableAlbum} maxWidth={420} labelledBy={titleId}>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <Artwork url={album.artworkUrl} label={album.title} radius="art" className="h-16 w-16 shrink-0 opacity-60 grayscale" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content-primary" title={album.title}>{album.title}</p>
            <p className="truncate text-[13px] text-content-tertiary" title={artists}>{artists}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold tracking-tight text-content-primary">
            <CloudOff className="h-5 w-5 text-content-tertiary" aria-hidden />
            {t("unavailableAlbum.title")}
          </h2>
          <p className="text-sm leading-6 text-content-secondary">{t("unavailableAlbum.body")}</p>
        </div>
        <p className="min-h-5 text-[13px] text-content-tertiary" aria-live="polite">
          {phase === "loading" && t("unavailableAlbum.loading")}
          {phase === "lost" && t("unavailableAlbum.lost")}
          {phase === "failed" && t("unavailableAlbum.failed")}
        </p>
        <div className="flex flex-col gap-2">
          {phase === "failed" ? (
            <button type="button" className={`${actionClass} octave-brand-fill`} onClick={() => void loaded.refetch()}>
              {t("common.retry")}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`${actionClass} octave-brand-fill`}
                disabled={likable.length === 0 || allLiked}
                onClick={() => {
                  bulk.like(likable);
                  closeUnavailableAlbum();
                }}
              >
                <Heart className="h-4 w-4" fill={allLiked ? "currentColor" : "none"} aria-hidden />
                {t("unavailableAlbum.like")}
              </button>
              <button
                type="button"
                className={`${actionClass} bg-fill-subtle text-content-primary hover:bg-octave-hover`}
                disabled={addable.length === 0}
                onClick={() => {
                  closeUnavailableAlbum();
                  openPlaylistChooserForMany(addable);
                }}
              >
                <ListPlus className="h-4 w-4" aria-hidden />
                {t("unavailableAlbum.addToPlaylist")}
              </button>
            </>
          )}
          <button type="button" className={`${actionClass} text-content-secondary hover:text-content-primary`} onClick={closeUnavailableAlbum}>
            {t("unavailableAlbum.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
