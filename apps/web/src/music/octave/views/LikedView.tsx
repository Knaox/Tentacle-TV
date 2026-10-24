/**
 * Octave — « Titres likés » : les favoris Jellyfin du compte, et en tête ce
 * qu'on vient d'aimer hors bibliothèque, « en attente », lisible tout de suite
 * (le cache de l'extension), remplacé par l'élément Jellyfin à `music:resolved`.
 */

import { useMemo } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CollectionHeader, useCountAndDuration } from "../components/CollectionHeader";
import { TrackList } from "../components/TrackList";
import { EmptyState, ErrorState, RowsSkeleton } from "../components/ViewStates";
import { useMusicLiked } from "@tentacle-tv/api-client";
import { flattenPages } from "./LoadMore";
import { mergeLiked, queueActions } from "@tentacle-tv/shared/octave";
import { usePendingMusic } from "../pending/usePendingMusic";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { LoadMore } from "./LoadMore";

export function LikedView() {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const liked = useMusicLiked();
  const pending = usePendingMusic();
  const rows = useMemo(() => mergeLiked(flattenPages(liked.data?.pages), pending), [liked.data, pending]);
  const waiting = rows.filter((r) => r.pending).length;
  const total = (liked.data?.pages[0]?.total ?? rows.length - waiting) + waiting;
  const duration = rows.reduce((sum, r) => sum + (r.track.durationMs ?? 0), 0);
  const meta = useCountAndDuration(total, duration);
  const tracks = rows.map((r) => r.track);

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t("liked.kicker")}
        title={t("liked.title")}
        art={
          <div className="octave-brand-fill flex h-44 w-44 shrink-0 items-center justify-center rounded-md shadow-2xl md:h-56 md:w-56" aria-hidden>
            <Heart className="h-20 w-20" fill="currentColor" strokeWidth={0} />
          </div>
        }
        meta={<span>{meta}</span>}
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, "liked")}
        onShuffle={() => queueActions.playShuffled(player, tracks, "liked")}
      />
      <div className="px-2 md:px-6">
        {liked.isPending && <RowsSkeleton />}
        {liked.isError && <ErrorState onRetry={() => void liked.refetch()} />}
        {liked.isSuccess && rows.length === 0 && <EmptyState>{t("liked.empty")}</EmptyState>}
        {rows.length > 0 && <TrackList rows={rows} contextId="liked" showArtwork showAlbum showHeader label={t("liked.title")} />}
        <LoadMore query={liked} />
      </div>
    </div>
  );
}
