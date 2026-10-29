/**
 * Octave — un artiste : photo, ses titres phares (cinq, « Afficher plus » pour
 * dix), puis ses parutions rangées par type (albums, singles et EP,
 * compilations, live, autres). La ligne de détails dit ce que la page contient
 * (« 12 parutions »), pas le nombre de titres phares. Un artiste d'ailleurs :
 * ce que la bibliothèque a de lui y est montré et joué comme le sien, marqué
 * (titres, albums entiers ; un album en partie présent porte « En partie »).
 */

import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { AlbumCard, CardGrid, Shelf } from "../components/Cards";
import { CollectionHeader } from "../components/CollectionHeader";
import { ShelfHeartButton } from "../collections/ShelfHeartButton";
import { ImportedBadge } from "../releases/ImportedBadge";
import { TrackList, rowsOf } from "../components/TrackList";
import { ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { useArtistEntity } from "../data/useEntityQueries";
import type { ShownAlbum } from "../library/ownedItems";
import { useOwnedAlbums } from "../library/useOwnedAlbums";
import { useOwnedTracks } from "../library/useOwnedTracks";
import { ARTIST_TOP_FOLDED, ARTIST_TOP_MAX, groupReleases, queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { ArtistMore } from "./artist/ArtistMore";
import { useRecordVisit } from "../search/recentVisits";

// Le rangement des parutions et les titres phares sont partagés avec le mobile.
export { groupReleases } from "@tentacle-tv/shared/octave";
const TOP_FOLDED = ARTIST_TOP_FOLDED;
const TOP_MAX = ARTIST_TOP_MAX;

const NO_ALBUMS: MusicAlbum[] = [];

export function ArtistView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const artist = useArtistEntity(id);
  useRecordVisit("artist", artist.isPlaceholder ? undefined : artist.data);
  const [expanded, setExpanded] = useState(false);
  const shownTop = useMemo(() => (artist.data?.topTracks ?? []).slice(0, TOP_MAX), [artist.data]);
  const { tracks: top } = useOwnedTracks(shownTop);
  const topRows = useMemo(() => rowsOf(expanded ? top : top.slice(0, TOP_FOLDED)), [expanded, top]);
  const albums: ShownAlbum[] = useOwnedAlbums(artist.data?.albums ?? NO_ALBUMS);
  const groups = useMemo(() => groupReleases(albums), [albums]);
  const elsewhere = artist.data?.jellyfinId === null;
  const contextId = `artist:${id}`;

  if (artist.isPending) {
    return (
      <>
        <HeaderSkeleton round />
        <div className="px-2 md:px-6">
          <RowsSkeleton rows={TOP_FOLDED} />
        </div>
      </>
    );
  }
  if (artist.isError || !artist.data) return <ErrorState onRetry={() => void artist.refetch()} message={t("artist.notFound")} />;
  const data = artist.data;
  const releases = data.albums?.length ?? 0;

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t("artist.kicker")}
        title={data.name}
        artworkUrl={data.imageUrl}
        round
        meta={
          <>
            {releases > 0 ? <span>{t("views.releases", { count: releases })}</span> : <span />}
            {data.imported && <ImportedBadge variant="inline" />}
          </>
        }
        canPlay={top.length > 0}
        onPress={() => top[0] && player.prefetch([top[0]], "press")}
        onPlay={() => player.playList(top, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, top, contextId)}
        extra={<ShelfHeartButton subject={{ section: "artists", item: data }} />}
      />
      <div className="flex flex-col gap-10 px-2 md:px-6">
        {top.length > 0 && (
          <Shelf title={t("artist.top")}>
            {/* La file reprend les DIX titres phares, repliés ou non : seul l'affichage se replie. */}
            <TrackList rows={topRows} queueTracks={top} contextId={contextId} showArtwork markLibrary={elsewhere} label={t("artist.top")} />
            {top.length > TOP_FOLDED && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="mx-2 self-start rounded-sm text-sm font-semibold text-content-tertiary hover:text-content-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                {t(expanded ? "views.showLess" : "views.showMore")}
              </button>
            )}
          </Shelf>
        )}
        {groups.map(({ group, albums }) => (
          <Shelf key={group} title={t(`artist.${group}`)}>
            <CardGrid>
              {albums.map(({ album, ownership }) => (
                <AlbumCard key={album.key} album={album} ownership={ownership} />
              ))}
            </CardGrid>
          </Shelf>
        ))}
        {/* Mission 3 : ce que l'autre côté (l'extension, ou la bibliothèque) connaît de plus, dessous. */}
        <ArtistMore artist={data} shown={albums} groupOf={groupReleases} contextId={contextId} />
      </div>
    </div>
  );
}
