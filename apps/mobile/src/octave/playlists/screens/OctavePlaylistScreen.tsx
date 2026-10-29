/**
 * Octave mobile — une PLAYLIST, comme le bureau : sa tête (pochette, nom, description, nombre de titres et
 * durée, Lecture, Aléatoire), puis ses titres — chercher, filtrer, trier, et, en mode « Modifier » seulement,
 * glisser un titre à sa place par sa poignée (l'ordre glissé devient celui de la playlist Jellyfin ; les attentes gardent la leur dans la
 * préférence du compte). Une playlist modifiable a « Modifier » (le « – » de chaque titre, avec « Annuler »
 * dans l'avis) et « ⋯ » (renommer, dupliquer, partager, supprimer). Tout se voit en direct sur les autres
 * appareils du compte (`music:playlist`, `music:listPrefs`).
 */

import { useCallback, useMemo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Import, ListMusic, MoreHorizontal, Search } from "lucide-react-native";
import { useImportInto } from "@tentacle-tv/api-client";
import { queueActions, type ListRow } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import { useOctavePagesProvider, usePagesPlayer } from "../../pages";
import { playFrom } from "../../pages/env/playFrom";
import { libraryPlaylistKey } from "@tentacle-tv/offline-core/music";
import { KeepCollectionButton } from "../../offline/KeepCollectionButton";
import { OfflinePageFallback } from "../../offline/OfflinePageFallback";
import { useOfflinePage } from "../../offline/useOfflinePage";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useOctaveNav } from "../../pages/env/nav";
import { LibraryPlaylistArtwork } from "../../pages/ui/PlaylistArtwork";
import { CollectionHeader, MetaLine } from "../../pages/entity/CollectionHeader";
import { useCountAndDuration } from "../../pages/entity/useCountAndDuration";
import { EmptyState, ErrorState, PillButton } from "../../pages/ui/ViewStates";
import { usePageMetrics } from "../../pages/ui/pageStyle";
import { usePlaylistData } from "../data/useListData";
import { openPlaylistSheet } from "../sheets/playlistSheetStore";
import { useMobilePlaylistRemoval } from "../sheets/useMobilePlaylistManage";
import { GlassIconButton } from "./BarButtons";
import { AddAllButton } from "../../pages/selection/AddAllButton";
import { ListPage } from "./ListPage";
import { SharedLine } from "../members/SharedLine";

export function OctavePlaylistScreen({ id }: { id: string }) {
  const { t } = useTranslation("music");
  const { t: ti } = useTranslation("musicImport");
  const theme = useTheme();
  const player = usePagesPlayer();
  const nav = useOctaveNav();
  const { gutter } = usePageMetrics();
  const { playlist, natural, order, editable, rules, loading } = usePlaylistData(id);
  const data = playlist.data;
  const target = useMemo(() => (data ? { jellyfinId: id, name: data.name } : null), [data, id]);
  const removeRows = useMobilePlaylistRemoval(target);
  const onRemove = useCallback((row: ListRow) => void removeRows(natural, new Set([row.rowKey])), [natural, removeRows]);
  const onRemoveRows = useCallback((rowKeys: readonly string[]) => void removeRows(natural, new Set(rowKeys)), [natural, removeRows]);
  const tracks = useMemo(() => order.rows.map((r) => r.track), [order.rows]);
  const allTracks = useMemo(() => natural.map((r) => r.track), [natural]);
  const contextId = `playlist:${id}`;
  const page = useOfflinePage(playlist, [libraryPlaylistKey(id)]);
  // Modifier, gérer : le serveur seul le sait faire — hors ligne, la playlist se lit, elle ne se modifie pas.
  const offline = useOfflineMode();
  const canEdit = editable && !offline;
  // Partagée : retirer suit le droit du compte (le serveur le tient) ; un membre a « ⋯ » pour voir et quitter.
  const canRemove = rules.canRemove && !offline;
  // Un album, des fichiers du téléphone : à la fin de CETTE playlist (si le compte peut y ajouter).
  const intoPaths = useImportInto(useOctavePagesProvider());
  const meta = useCountAndDuration(natural.length, natural.reduce((s, r) => s + (r.track.durationMs ?? 0), 0));

  // Hors ligne, la page gardée (son dernier affichage en ligne) se montre ; sans elle, la playlist gardée sur l'appareil.
  if (page.view === "kept" || page.view === "offlineMissing") return <OfflinePageFallback keptKey={page.keptKey} />;
  if (page.view === "error") return <ErrorState onRetry={() => void playlist.refetch()} message={t("playlist.notFound")} />;

  const hero = (scrollY: Parameters<typeof CollectionHeader>[0]["scrollY"]) => (
    <>
      <CollectionHeader
        kicker={t("playlist.kicker")}
        title={data?.name ?? ""}
        artworkUrl={data?.artworkUrl ?? null}
        renderArt={data ? (size) => <LibraryPlaylistArtwork playlist={data} size={size} radius={14} /> : undefined}
        scrollY={scrollY}
        meta={
          <>
            <MetaLine parts={[loading ? null : meta]} />
            {data ? <SharedLine playlist={data} /> : null}
          </>
        }
        canPlay={tracks.length > 0}
        // La lecture suit l'ordre AFFICHÉ (trié, cherché) : « Lecture » joue ce qu'on voit.
        onPlay={() => playFrom(player, tracks, 0, contextId)}
        onShuffle={() => player && queueActions.playShuffled(player, tracks, contextId)}
        // Garder la playlist ENTIÈRE sur l'appareil (et la tenir à jour), comme le bureau.
        extra={
          data && !loading ? (
            <>
              <KeepCollectionButton kind="playlist" collectionKey={`jf:${id}`} title={data.name} tracks={allTracks} />
              {/* Tous ses titres, dans l'ordre, dans une AUTRE playlist (doublons : au choix). */}
              <AddAllButton tracks={allTracks} />
            </>
          ) : undefined
        }
      />
      {data?.description ? <Text style={[typography.caption, { color: theme.colors.text.secondary, paddingHorizontal: gutter, paddingBottom: 8, textAlign: "center" }]}>{data.description}</Text> : null}
    </>
  );

  const importInto =
    data && !offline && rules.canAdd && (intoPaths.albumAvailable || intoPaths.filesAvailable)
      ? () => openPlaylistSheet({ kind: "import", into: { playlistId: id, name: data.name } })
      : null;

  const empty = (
    <EmptyState
      icon={ListMusic}
      title={t("playlist.empty")}
      hint={rules.canAdd ? t("views.playlistEmptyHint") : undefined}
      action={
        <View style={{ alignItems: "center", gap: 8 }}>
          <PillButton label={t("views.findMusic")} icon={Search} onPress={() => nav.search()} />
          {importInto ? <PillButton label={ti("entryShort")} icon={Import} onPress={importInto} /> : null}
        </View>
      }
    />
  );

  const manage =
    data && !offline && (canEdit || rules.isMember) ? (
      <GlassIconButton icon={MoreHorizontal} label={t("playlistManage.more", { name: data.name })} onPress={() => openPlaylistSheet({ kind: canEdit ? "manage" : "members", playlist: data })} />
    ) : null;
  const actions =
    importInto && data ? (
      <View style={{ flexDirection: "row", gap: 8 }}>
        <GlassIconButton icon={Import} label={ti("intoTitle", { name: data.name })} onPress={importInto} />
        {manage}
      </View>
    ) : (
      manage
    );

  return (
    <ListPage
      title={data?.name ?? ""}
      contextId={contextId}
      hero={hero}
      natural={natural}
      order={order}
      loading={loading}
      empty={empty}
      onRemove={canRemove ? onRemove : undefined}
      onRemoveRows={canRemove ? onRemoveRows : undefined}
      actions={actions}
    />
  );
}
