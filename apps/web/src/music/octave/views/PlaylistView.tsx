/**
 * Octave — une playlist Jellyfin : ses entrées, et à leur place les ajouts
 * hors bibliothèque « en attente » (entrées `pending:<id>`), lisibles tout de
 * suite. Une playlist modifiable permet de retirer une entrée. Avec
 * `music.listOrder` : chercher, filtrer, trier, et glisser un titre à sa place
 * (l'ordre glissé devient celui de la playlist Jellyfin ; les attentes gardent
 * la leur dans la préférence du compte).
 */

import { useCallback, useMemo, useState } from "react";
import { ListMusic, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMusicPlaylist, usePlaylistSharingRules, useReorderMusicPlaylist } from "@tentacle-tv/api-client";
import { parseListKey } from "@tentacle-tv/shared/music";
import { CollectionHeader, useCountAndDuration } from "../components/CollectionHeader";
import { HEADER_ARTWORK_CLASS, PlaylistArtwork, playlistCoverUrls } from "../components/PlaylistArtwork";
import { KeepCollectionButton } from "../offline/KeepCollectionButton";
import { KeptSizeMeta } from "../offline/KeptSizeMeta";
import { TrackList } from "../components/TrackList";
import { EMPTY_ACTION_CLASS, EmptyState, ErrorState, HeaderSkeleton, RowsSkeleton } from "../components/ViewStates";
import { octavePaths } from "../octavePaths";
import { mergePlaylist, queueActions } from "@tentacle-tv/shared/octave";
import { usePendingMusic } from "../pending/usePendingMusic";
import { useLibraryFirstRows } from "@tentacle-tv/api-client";
import { usePlaylistRemoval } from "../actions/usePlaylistRemoval";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { makeStatsOf } from "@tentacle-tv/shared/octave";
import { useListOrder } from "@tentacle-tv/api-client";
import { ListToolbar } from "../listOrder/ListToolbar";
import { NoMatch } from "../listOrder/NoMatch";
import { PlaylistMenuButton, playlistSubject } from "../playlists/PlaylistMenu";
import { ShelfHeartButton } from "../collections/ShelfHeartButton";
import { SharedPlaylistLine } from "../playlists/members/SharedPlaylistLine";

export function PlaylistView() {
  const { t } = useTranslation("music");
  const { id = "" } = useParams();
  const player = useOctavePlayer();
  const playlist = useMusicPlaylist(id);
  const target = useMemo(() => (playlist.data ? { jellyfinId: id, name: playlist.data.name } : null), [id, playlist.data]);
  const removeRows = usePlaylistRemoval(target);
  const pending = usePendingMusic();
  // Jellyfin fait foi : une attente dont le titre est déjà dans la bibliothèque se montre comme lui.
  const natural = useLibraryFirstRows(useMemo(() => mergePlaylist(playlist.data?.entries ?? [], pending, id), [id, pending, playlist.data]));
  const statsOf = useMemo(
    () => makeStatsOf({ byEntry: new Map((playlist.data?.entries ?? []).flatMap((e) => (e.stats ? [[e.entryId, e.stats] as const] : []))), pending, natural }),
    [natural, pending, playlist.data],
  );
  const editable = playlist.data?.editable === true;
  // Partagée (`musicPlaylistMembers.ts`) : chacun son ordre, jamais celui de Jellyfin ; les ajouts des autres au bout.
  const shared = usePlaylistSharingRules(playlist.data);
  const reorderPlaylist = useReorderMusicPlaylist();
  const onJellyfinOrder = useCallback((entryIds: string[]) => reorderPlaylist(id, entryIds), [id, reorderPlaylist]);
  const order = useListOrder(parseListKey(`playlist:${id}`), natural, statsOf, {
    complete: true,
    onJellyfinOrder: editable && !shared.isShared ? onJellyfinOrder : undefined,
    newcomers: shared.isShared ? "end" : undefined,
  });
  const rows = order.rows;
  // La lecture suit l'ordre AFFICHÉ (trié, cherché) : « Lire » joue ce qu'on voit.
  const tracks = useMemo(() => rows.map((r) => r.track), [rows]);
  const allTracks = useMemo(() => natural.map((r) => r.track), [natural]);
  const meta = useCountAndDuration(natural.length, natural.reduce((s, r) => s + (r.track.durationMs ?? 0), 0));
  const contextId = `playlist:${id}`;
  const [menuOpen, setMenuOpen] = useState(false);
  // Une entrée Jellyfin comme un titre hors bibliothèque en attente (sa demande s'annule), d'un geste : l'avis porte « Annuler ».
  const onRemoveRows = useCallback((keys: string[]) => void removeRows(natural, new Set(keys)), [removeRows, natural]);

  // Le tri du compte avant la première rangée : jamais une liste qui se réordonne sous les yeux.
  if (playlist.isPending || !order.ready) {
    return (
      <>
        <HeaderSkeleton />
        <RowsSkeleton />
      </>
    );
  }
  if (playlist.isError || !playlist.data) return <ErrorState onRetry={() => void playlist.refetch()} message={t("playlist.notFound")} />;

  const data = playlist.data;

  return (
    <div className="pb-10">
      <CollectionHeader
        kicker={t("playlist.kicker")}
        title={data.name}
        art={<PlaylistArtwork urls={playlistCoverUrls(data)} label={data.name} radius="lg" eager className={HEADER_ARTWORK_CLASS} />}
        meta={
          <>
            <span>{meta}</span>
            <SharedPlaylistLine playlist={data} />
            <KeptSizeMeta kind="playlist" collectionKey={`jf:${id}`} tracks={allTracks} />
          </>
        }
        canPlay={tracks.length > 0}
        onPress={() => tracks[0] && player.prefetch([tracks[0]], "press")}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
        description={data.description ?? null}
        extra={
          <>
            <ShelfHeartButton subject={playlistSubject(data)} />
            <KeepCollectionButton kind="playlist" collectionKey={`jf:${id}`} title={data.name} tracks={allTracks} />
            {/* Gérer la playlist : seulement si le serveur dit que ce compte peut la modifier. */}
            <PlaylistMenuButton playlist={data} open={menuOpen} onOpenChange={setMenuOpen} className="h-12 w-12" />
          </>
        }
      />
      <div className="px-2 md:px-6">
        {natural.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title={t("playlist.empty")}
            action={
              <Link to={octavePaths.search} className={EMPTY_ACTION_CLASS}>
                <Search className="h-4 w-4" aria-hidden />
                {t("views.findMusic")}
              </Link>
            }
          >
            {shared.canAdd ? t("views.playlistEmptyHint") : null}
          </EmptyState>
        ) : (
          <>
            {order.capable && (
              <ListToolbar
                query={order.query}
                onQuery={order.setQuery}
                filter={order.filter}
                filters={order.filters}
                onFilter={order.setFilter}
                prefs={order.prefs}
                sorts={order.sorts}
                onSort={order.onSort}
                shown={rows.length}
                total={natural.length}
              />
            )}
            {rows.length === 0 ? (
              <NoMatch onReset={order.reset} />
            ) : (
              <TrackList rows={rows} contextId={contextId} showArtwork showAlbum showHeader label={data.name} onRemoveRows={shared.canRemove ? onRemoveRows : undefined} virtual reorder={order.reorder} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
