/**
 * Octave — « Sur cet appareil » (`/octave/device`, bureau) : la musique que le
 * compte de l'appareil a gardée, lisible SANS RÉSEAU. Les albums et playlists
 * gardés en entier en tête (un clic les ouvre ici même : leur vue d'origine
 * demande le serveur), puis les titres. Hors ligne, c'est la seule vue d'Octave
 * (`OfflineOctave.tsx`) et elle ne montre que ce qui est complet.
 *
 * Une playlist ouverte est la playlist EN LIGNE en version hors ligne : son
 * ordre, ses tris, ses filtres, sa recherche, le même rendu (`useKeptListRows`).
 *
 * La place prise : en tête (tout, et l'espace libre du disque quand la coquille
 * le dit), sur chaque album et playlist, et sur celui qu'on ouvre.
 *
 * En ligne, « Passer hors ligne » dans l'en-tête ; hors ligne, l'avis porte la
 * sortie (`OfflineSwitch.tsx`).
 *
 * Tout vient de la base des transferts (`keptMusicStore.ts`) : aucune requête.
 */

import { useMemo } from "react";
import { ChevronLeft, WifiOff } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { queueActions } from "@tentacle-tv/shared/octave";
import { localResourceUrl, useDownloadsRootReady } from "../../../downloads/localFiles";
import { DownloadGlyph } from "../../../downloads/DownloadGlyph";
import { formatBytes } from "../../../downloads/presets";
import { useDiskInfo } from "../../../downloads/useDownloadState";
import { useOfflineMode } from "../../../offline/useOfflineMode";
import { ARTWORK_RADIUS } from "../components/Artwork";
import { CardGrid, Shelf } from "../components/Cards";
import { CollectionHeader } from "../components/CollectionHeader";
import { rowsOf, TrackList } from "../components/TrackList";
import { EmptyState, RowsSkeleton } from "../components/ViewStates";
import { ListToolbar } from "../listOrder/ListToolbar";
import { NoMatch } from "../listOrder/NoMatch";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { deviceModel, type DeviceCollection, bytesOnDisk, collectionBytes } from "@tentacle-tv/offline-core/music";
import { KeepCollectionButton } from "./KeepCollectionButton";
import { OfflineNotice, OfflineSwitchButton } from "./OfflineSwitch";
import { ServerPacingNotice } from "./ServerPacingNotice";
import { useKeptListRows } from "./useKeptListRows";
import { KeptCollectionArtwork } from "./KeptCollectionArtwork";
import { HEADER_ARTWORK_CLASS } from "../components/PlaylistArtwork";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { useKeptMusic } from "./useKeptMusic";
import { AutoSyncSetting } from "./autosync/AutoSyncSetting";

const DEVICE_CONTEXT = "device";

const cardClass =
  "octave-card group flex min-w-0 cursor-pointer flex-col gap-2 rounded-[var(--oc-radius-art)] p-2 text-left transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

function CollectionCard({ collection, bytes, kept, offline, onOpen }: { collection: DeviceCollection; bytes: number; kept: readonly KeptMusicTrack[]; offline: boolean; onOpen: () => void }) {
  const { t } = useTranslation("music");
  const detail = `${collection.subtitle ?? t("count.tracks", { count: collection.tracks.length })} · ${formatBytes(bytes)}`;
  return (
    <button type="button" className={cardClass} onClick={onOpen}>
      <KeptCollectionArtwork collection={collection} kept={kept} offline={offline} className="aspect-square w-full shadow-[var(--oc-shadow-art)]" />
      <span className="min-w-0 px-0.5">
        <span className="block truncate text-sm font-semibold leading-5 text-content-primary" title={collection.title}>{collection.title}</span>
        <span className="block truncate text-[13px] leading-5 tabular-nums text-content-tertiary" title={detail}>{detail}</span>
      </span>
    </button>
  );
}

function DeviceArt() {
  return (
    <div className="octave-brand-fill flex h-44 w-44 shrink-0 items-center justify-center shadow-[var(--oc-shadow-art-lg)] md:h-56 md:w-56" style={{ borderRadius: ARTWORK_RADIUS.lg }} aria-hidden>
      <DownloadGlyph done className="h-20 w-20" />
    </div>
  );
}

export function DeviceView() {
  const { t } = useTranslation("musicOffline");
  const { t: tm } = useTranslation("music");
  const player = useOctavePlayer();
  const offline = useOfflineMode();
  const kept = useKeptMusic();
  const rootReady = useDownloadsRootReady();
  const { freeBytes } = useDiskInfo();
  const [params, setParams] = useSearchParams();
  // La pochette locale arrive avec la racine des transferts (`rootReady`).
  const model = useMemo(
    // `resolve` : les copies sous la clé d'aujourd'hui d'un titre renommé (`byKey` du magasin).
    () => deviceModel(kept.tracks, kept.collections, rootReady ? localResourceUrl : () => null, { completeOnly: offline, resolve: (key) => kept.byKey.get(key) }),
    [kept.tracks, kept.collections, kept.byKey, offline, rootReady],
  );
  const open = model.collections.find((c) => c.key === params.get("c")) ?? null;
  // Une playlist ouverte : la playlist en ligne, en version hors ligne (`useKeptListRows`) ; « Lire » joue ce qu'on voit.
  const list = useKeptListRows(open);
  const allRows = useMemo(() => rowsOf(model.tracks), [model.tracks]);
  const rows = open ? list.rows : allRows;
  const tracks = useMemo(() => rows.map((r) => r.track), [rows]);
  const count = open ? list.natural.length : model.tracks.length;
  const contextId = open ? `${DEVICE_CONTEXT}:${open.key}` : DEVICE_CONTEXT;
  const bytesOf = (c: DeviceCollection) => collectionBytes(c.tracks.map((track) => track.key), kept.byKey);
  // La place : celle de la collection ouverte ; en tête, tout ce qui est gardé, et ce que le disque a encore de libre.
  const meta = [
    tm("count.tracks", { count }),
    open ? formatBytes(bytesOf(open)) : t("view.used", { size: formatBytes(bytesOnDisk(kept.tracks)) }),
    !open && freeBytes !== null ? t("view.free", { size: formatBytes(freeBytes) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="pb-10">
      {open && (
        <button type="button" onClick={() => setParams({})} className="ml-4 mt-4 flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-content-secondary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus md:ml-8">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t("view.title")}
        </button>
      )}
      <CollectionHeader
        kicker={open ? tm(open.kind === "album" ? "album.kind.album" : "playlist.kicker") : t("view.kicker")}
        title={open?.title ?? t("view.title")}
        art={open ? <KeptCollectionArtwork collection={open} kept={kept.tracks} offline={offline} radius="lg" eager className={HEADER_ARTWORK_CLASS} /> : <DeviceArt />}
        meta={kept.loaded ? <span className="tabular-nums">{meta}</span> : null}
        canPlay={tracks.length > 0}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
        extra={
          <>
            {open && <KeepCollectionButton kind={open.kind} collectionKey={open.key.slice(open.key.indexOf(":") + 1)} title={open.title} subtitle={open.subtitle} tracks={open.tracks} />}
            <OfflineSwitchButton />
          </>
        }
      />
      <div className="flex flex-col gap-8 px-2 md:px-6">
        {offline && <OfflineNotice />}
        {!open && !offline && <ServerPacingNotice tracks={kept.tracks} />}
        {!open && !offline && <AutoSyncSetting variant="inline" />}
        {kept.loaded && model.tracks.length === 0 && (
          <EmptyState icon={WifiOff} title={t("view.empty")}>
            {t("view.emptyHint")}
          </EmptyState>
        )}
        {!open && model.collections.length > 0 && (
          <Shelf title={t("view.collections")}>
            <CardGrid>
              {model.collections.map((c) => (
                <CollectionCard key={c.key} collection={c} bytes={bytesOf(c)} kept={kept.tracks} offline={offline} onOpen={() => setParams({ c: c.key })} />
              ))}
            </CardGrid>
          </Shelf>
        )}
        {open ? (
          <section className="flex flex-col">
            {list.toolbar && list.natural.length > 0 && (
              <ListToolbar
                query={list.order.query}
                onQuery={list.order.setQuery}
                filter={list.order.filter}
                filters={list.order.filters}
                onFilter={list.order.setFilter}
                prefs={list.order.prefs}
                sorts={list.order.sorts}
                onSort={list.order.onSort}
                shown={rows.length}
                total={list.natural.length}
              />
            )}
            {!list.ready ? (
              <RowsSkeleton />
            ) : rows.length === 0 ? (
              list.natural.length > 0 && <NoMatch onReset={list.order.reset} />
            ) : open.kind === "playlist" ? (
              // Le rendu de la playlist en ligne (`PlaylistView`), sans glisser ni retrait.
              <TrackList rows={rows} contextId={contextId} showArtwork showAlbum showHeader label={open.title} virtual />
            ) : (
              <TrackList rows={rows} contextId={contextId} showArtwork label={open.title} />
            )}
          </section>
        ) : (
          rows.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="oc-heading px-2 text-xl text-content-primary">{t("view.tracks")}</h2>
              <TrackList rows={rows} contextId={contextId} showArtwork showAlbum label={t("view.title")} />
            </section>
          )
        )}
      </div>
    </div>
  );
}
