/**
 * Octave — la page d'un MIX de l'accueil (`/octave/home-mix/:id`, `pages/homeMix.ts`) : consultable comme un album
 * — sa jaquette (la mosaïque du mix), son nom, ses artistes, Lecture et Aléatoire, ses titres (« … », ajout, cœur :
 * ceux de toute liste). Le mix vient de la réponse de l'accueil déjà en cache : la page s'écrit sans attente depuis
 * sa carte ; une adresse ouverte à froid relit l'accueil, un mix renouvelé depuis dit « introuvable ». Même file
 * que la carte (`mixContextId`) : le mix lancé depuis l'une se reconnaît sur l'autre.
 */

import { useMemo } from "react";
import { ListMusic } from "lucide-react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMusicHome } from "@tentacle-tv/api-client";
import { findHomeMix, queueActions } from "@tentacle-tv/shared/octave";
import { CollectionHeader, Dot, useCountAndDuration } from "../components/CollectionHeader";
import { HEADER_ARTWORK_CLASS, PlaylistArtwork } from "../components/PlaylistArtwork";
import { TrackList, rowsOf } from "../components/TrackList";
import { EmptyState, ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { mixContextId, mixMosaic, mixSubtitle, mixTitle } from "./homeModel";

export function MixView() {
  const { t, i18n } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const home = useMusicHome();
  const mix = findHomeMix(home.data, id);
  const tracks = useMemo(() => mix?.tracks ?? [], [mix]);
  const rows = useMemo(() => rowsOf(tracks), [tracks]);
  const urls = useMemo(() => mixMosaic(tracks), [tracks]);
  const meta = useCountAndDuration(tracks.length, tracks.reduce((s, track) => s + (track.durationMs ?? 0), 0));

  if (!mix && home.isPending && home.fetchStatus !== "idle") {
    return (
      <>
        <HeaderSkeleton />
        <RowsSkeleton />
      </>
    );
  }
  if (!mix) return <ErrorState onRetry={() => void home.refetch()} message={t("octaveHome.mixNotFound")} />;

  const name = mixTitle(mix);
  const title = name.key === "octaveHome.mixArtist" ? t(name.key, { artist: name.artist }) : t(name.key);
  const artists = mixSubtitle(mix, i18n.language);
  const contextId = mixContextId(mix);
  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t("octaveHome.mixKicker")}
        title={title}
        art={<PlaylistArtwork urls={urls} label={title} radius="lg" eager className={HEADER_ARTWORK_CLASS} />}
        meta={
          <>
            {artists && <span className="font-semibold text-content-primary">{artists}</span>}
            {artists && <Dot />}
            <span>{meta}</span>
            <Dot />
            <span>{t("octaveHome.mixFresh")}</span>
          </>
        }
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
      />
      <div className="px-2 md:px-6">
        {rows.length === 0 ? (
          <EmptyState icon={ListMusic} title={t("octaveHome.mixEmpty")} />
        ) : (
          <TrackList rows={rows} contextId={contextId} showArtwork showAlbum label={title} showHeader />
        )}
      </div>
    </div>
  );
}
