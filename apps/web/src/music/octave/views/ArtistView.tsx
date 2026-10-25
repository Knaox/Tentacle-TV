/**
 * Octave — un artiste : photo, ses titres phares (cinq, « Afficher plus » pour
 * dix), puis ses parutions rangées par type (albums, singles et EP,
 * compilations, live, autres). La ligne de détails dit ce que la page contient
 * (« 12 parutions »), pas le nombre de titres phares.
 */

import { useMemo, useState } from "react";
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

/** Titres phares : cinq montrés, dix au plus. */
const TOP_FOLDED = 5;
const TOP_MAX = 10;

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
  const [expanded, setExpanded] = useState(false);
  const top = useMemo(() => (artist.data?.topTracks ?? []).slice(0, TOP_MAX), [artist.data]);
  const topRows = useMemo(() => rowsOf(expanded ? top : top.slice(0, TOP_FOLDED)), [expanded, top]);
  const groups = useMemo(() => groupReleases(artist.data?.albums ?? []), [artist.data]);
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
        meta={releases > 0 ? <span>{t("views.releases", { count: releases })}</span> : <span />}
        canPlay={top.length > 0}
        onPress={() => top[0] && player.prefetch([top[0]], "press")}
        onPlay={() => player.playList(top, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, top, contextId)}
      />
      <div className="flex flex-col gap-10 px-2 md:px-6">
        {top.length > 0 && (
          <Shelf title={t("artist.top")}>
            {/* La file reprend les DIX titres phares, repliés ou non : seul l'affichage se replie. */}
            <TrackList rows={topRows} queueTracks={top} contextId={contextId} showArtwork label={t("artist.top")} />
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
