/**
 * Octave — « Titres likés » : les favoris Jellyfin du compte, et en tête ce
 * qu'on vient d'aimer hors bibliothèque, « en attente », lisible tout de suite
 * (le cache de l'extension), remplacé par l'élément Jellyfin à `music:resolved`.
 * Pendant l'attente, la ligne de détails garde sa place (jamais « 0 titre »
 * qui devient « 234 titres » sous les yeux).
 */

import { useMemo } from "react";
import { Heart, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ARTWORK_RADIUS } from "../components/Artwork";
import { CollectionHeader, useCountAndDuration } from "../components/CollectionHeader";
import { TrackList } from "../components/TrackList";
import { EMPTY_ACTION_CLASS, EmptyState, ErrorState, RowsSkeleton } from "../components/ViewStates";
import { octavePaths } from "../octavePaths";
import { useMusicLiked } from "@tentacle-tv/api-client";
import { flattenPages } from "./LoadMore";
import { mergeLiked, queueActions } from "@tentacle-tv/shared/octave";
import { usePendingMusic } from "../pending/usePendingMusic";
import { useLibraryFirstRows } from "../library/useLibraryFirstRows";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { LoadMore } from "./LoadMore";

export function LikedView() {
  const { t } = useTranslation("music");
  const player = useOctavePlayer();
  const liked = useMusicLiked();
  const pending = usePendingMusic();
  // Jellyfin fait foi : une attente dont le titre est déjà dans la bibliothèque se montre comme lui.
  const rows = useLibraryFirstRows(useMemo(() => mergeLiked(flattenPages(liked.data?.pages), pending), [liked.data, pending]));
  const waiting = rows.filter((r) => r.pending).length;
  const total = (liked.data?.pages[0]?.total ?? rows.length - waiting) + waiting;
  const duration = rows.reduce((sum, r) => sum + (r.track.durationMs ?? 0), 0);
  const meta = useCountAndDuration(total, duration);
  const tracks = useMemo(() => rows.map((r) => r.track), [rows]);

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t("liked.kicker")}
        title={t("liked.title")}
        art={
          <div className="octave-brand-fill flex h-44 w-44 shrink-0 items-center justify-center shadow-[var(--oc-shadow-art-lg)] md:h-56 md:w-56" style={{ borderRadius: ARTWORK_RADIUS.lg }} aria-hidden>
            <Heart className="h-20 w-20" fill="currentColor" strokeWidth={0} />
          </div>
        }
        meta={liked.isPending ? null : <span>{meta}</span>}
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, "liked")}
        onShuffle={() => queueActions.playShuffled(player, tracks, "liked")}
      />
      <div className="px-2 md:px-6">
        {liked.isPending && <RowsSkeleton />}
        {liked.isError && <ErrorState onRetry={() => void liked.refetch()} />}
        {liked.isSuccess && rows.length === 0 && (
          <EmptyState
            icon={Heart}
            title={t("views.likedEmptyTitle")}
            action={
              <Link to={octavePaths.search} className={EMPTY_ACTION_CLASS}>
                <Search className="h-4 w-4" aria-hidden />
                {t("views.findMusic")}
              </Link>
            }
          >
            {t("liked.empty")}
          </EmptyState>
        )}
        {rows.length > 0 && <TrackList rows={rows} contextId="liked" showArtwork showAlbum showHeader label={t("liked.title")} />}
        <LoadMore query={liked} />
      </div>
    </div>
  );
}
