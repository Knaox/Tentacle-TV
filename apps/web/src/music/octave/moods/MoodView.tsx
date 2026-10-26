/**
 * Octave — la page d'une AMBIANCE (`/octave/mood/:id`) : une vue playlist comme une autre — sa tête (son image, son
 * nom, combien de titres viennent de la bibliothèque), Lecture et Aléatoire, ses titres (« … », ajout, cœur : ceux de
 * toute playlist hors bibliothèque ; un titre que la bibliothèque a y est montré et joué comme le sien), puis
 * d'autres playlists de l'ambiance. Sans extension qui les sert : « introuvable », sans rien trahir.
 */

import { useMemo } from "react";
import { ListMusic } from "lucide-react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { queueActions } from "@tentacle-tv/shared/octave";
import { Shelf } from "../components/Cards";
import { CardRow } from "../components/CardRow";
import { CollectionHeader, Dot, useCountAndDuration } from "../components/CollectionHeader";
import { TrackList, rowsOf } from "../components/TrackList";
import { EmptyState, ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { useOwnedTracks } from "../library/useOwnedTracks";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { ExternalPlaylistCard } from "../search/ExternalPlaylistCard";
import { MoodArtwork } from "./MoodArtwork";
import { moodContextId } from "./useMoodPlayback";
import { useMoodMix } from "./useMoods";

export function MoodView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const mix = useMoodMix(id);
  const shown = useMemo(() => mix.data?.tracks ?? [], [mix.data]);
  const { tracks } = useOwnedTracks(shown);
  const rows = useMemo(() => rowsOf(tracks), [tracks]);
  const owned = useMemo(() => tracks.filter((track) => track.jellyfinId !== null).length, [tracks]);
  const meta = useCountAndDuration(tracks.length, tracks.reduce((s, track) => s + (track.durationMs ?? 0), 0));
  const contextId = moodContextId(id);

  if (mix.isPending && mix.fetchStatus !== "idle") {
    return (
      <>
        <HeaderSkeleton />
        <RowsSkeleton />
      </>
    );
  }
  if (!mix.data) {
    const status = (mix.error as { status?: number } | null)?.status;
    return <ErrorState onRetry={() => void mix.refetch()} message={t(status === 503 ? "moods.unavailable" : "moods.notFound")} />;
  }
  const data = mix.data;
  const playlists = data.playlists ?? [];

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t("moods.kicker")}
        title={data.mood.name}
        art={<MoodArtwork id={data.mood.id} color={data.mood.color} artworkUrl={data.mood.artworkUrl} className="h-44 w-44 shrink-0 rounded-[var(--oc-radius-art-lg)] shadow-[var(--oc-shadow-art-lg)] md:h-56 md:w-56" />}
        meta={
          <>
            <span>{meta}</span>
            {owned > 0 && <Dot />}
            {owned > 0 && <span className="font-semibold text-content-primary">{t("moods.inLibrary", { count: owned })}</span>}
          </>
        }
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
      />
      <div className="flex flex-col gap-10 px-2 md:px-6">
        {rows.length === 0 ? (
          <EmptyState icon={ListMusic} title={t("moods.empty")} />
        ) : (
          <TrackList rows={rows} contextId={contextId} showArtwork showAlbum markLibrary label={data.mood.name} showHeader />
        )}
        {playlists.length > 0 && (
          <Shelf title={t("moods.morePlaylists")}>
            <CardRow items={playlists} render={(p) => <ExternalPlaylistCard key={p.key} playlist={p} />} />
          </Shelf>
        )}
      </div>
    </div>
  );
}
