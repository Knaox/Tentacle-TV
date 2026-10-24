/**
 * Octave — un artiste : photo, ses titres phares, puis ses parutions rangées
 * par type (albums, singles et EP, compilations, live, autres).
 */

import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AlbumKind, MusicAlbum } from "@tentacle-tv/shared/music";
import { AlbumCard, CardGrid, Shelf } from "../components/Cards";
import { CollectionHeader } from "../components/CollectionHeader";
import { TrackList, rowsOf } from "../components/TrackList";
import { ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { useArtistEntity } from "../data/useEntityQueries";
import { queueActions } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "../player/OctavePlayerProvider";

type Group = "albums" | "singles" | "compilations" | "live" | "other";

const GROUP_OF: Record<AlbumKind, Group> = {
  album: "albums",
  single: "singles",
  ep: "singles",
  compilation: "compilations",
  live: "live",
  soundtrack: "other",
  other: "other",
};

const ORDER: Group[] = ["albums", "singles", "compilations", "live", "other"];

/** Les parutions par type, chacune de la plus récente à la plus ancienne. */
export function groupReleases(albums: readonly MusicAlbum[]): { group: Group; albums: MusicAlbum[] }[] {
  const map = new Map<Group, MusicAlbum[]>();
  for (const a of albums) map.set(GROUP_OF[a.kind], [...(map.get(GROUP_OF[a.kind]) ?? []), a]);
  return ORDER.filter((g) => map.has(g)).map((group) => ({
    group,
    albums: [...(map.get(group) ?? [])].sort((x, y) => (y.releaseDate ?? String(y.year ?? "")).localeCompare(x.releaseDate ?? String(x.year ?? ""))),
  }));
}

export function ArtistView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const artist = useArtistEntity(id);
  const top = useMemo(() => (artist.data?.topTracks ?? []).slice(0, 10), [artist.data]);
  const topRows = useMemo(() => rowsOf(top), [top]);
  const groups = useMemo(() => groupReleases(artist.data?.albums ?? []), [artist.data]);
  const contextId = `artist:${id}`;

  if (artist.isPending) {
    return (
      <>
        <HeaderSkeleton />
        <RowsSkeleton rows={5} />
      </>
    );
  }
  if (artist.isError || !artist.data) return <ErrorState onRetry={() => void artist.refetch()} message={t("artist.notFound")} />;
  const data = artist.data;

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t("artist.kicker")}
        title={data.name}
        artworkUrl={data.imageUrl}
        round
        meta={top.length > 0 ? <span>{t("count.tracks", { count: top.length })}</span> : null}
        canPlay={top.length > 0}
        onPress={() => top[0] && player.prefetch([top[0]], "press")}
        onPlay={() => player.playList(top, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, top, contextId)}
      />
      <div className="flex flex-col gap-10 px-2 md:px-6">
        {top.length > 0 && (
          <Shelf title={t("artist.top")}>
            <TrackList rows={topRows} contextId={contextId} showArtwork label={t("artist.top")} />
          </Shelf>
        )}
        {groups.map(({ group, albums }) => (
          <Shelf key={group} title={t(`artist.${group}`)}>
            <CardGrid>
              {albums.map((album) => (
                <AlbumCard key={album.key} album={album} />
              ))}
            </CardGrid>
          </Shelf>
        ))}
      </div>
    </div>
  );
}
