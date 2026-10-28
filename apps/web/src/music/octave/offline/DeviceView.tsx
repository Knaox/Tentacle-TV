/**
 * Octave — « Sur cet appareil » (`/octave/device`, bureau) : la musique que le
 * compte de l'appareil a gardée, lisible SANS RÉSEAU. Les albums et playlists
 * gardés en entier en tête (un clic les ouvre ici même : leur vue d'origine
 * demande le serveur), puis les titres. Hors ligne, c'est la seule vue d'Octave
 * (`OfflineOctave.tsx`) et elle ne montre que ce qui est complet.
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
import { useOfflineMode } from "../../../offline/useOfflineMode";
import { Artwork, ARTWORK_RADIUS } from "../components/Artwork";
import { CardGrid, Shelf } from "../components/Cards";
import { CollectionHeader } from "../components/CollectionHeader";
import { rowsOf, TrackList } from "../components/TrackList";
import { EmptyState } from "../components/ViewStates";
import { useOctavePlayer } from "../player/OctavePlayerProvider";
import { deviceModel, type DeviceCollection, keptBytes } from "@tentacle-tv/offline-core/music";
import { KeepCollectionButton } from "./KeepCollectionButton";
import { useKeptMusic } from "./useKeptMusic";
import { AutoSyncSetting } from "./autosync/AutoSyncSetting";

const DEVICE_CONTEXT = "device";

const cardClass =
  "octave-card group flex min-w-0 cursor-pointer flex-col gap-2 rounded-[var(--oc-radius-art)] p-2 text-left transition-colors duration-150 hover:bg-octave-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

function CollectionCard({ collection, onOpen }: { collection: DeviceCollection; onOpen: () => void }) {
  const { t } = useTranslation("music");
  return (
    <button type="button" className={cardClass} onClick={onOpen}>
      <Artwork url={collection.artworkUrl} label={collection.title} radius="art" className="aspect-square w-full shadow-[var(--oc-shadow-art)]" />
      <span className="min-w-0 px-0.5">
        <span className="block truncate text-sm font-semibold leading-5 text-content-primary" title={collection.title}>{collection.title}</span>
        <span className="block truncate text-[13px] leading-5 text-content-tertiary">{collection.subtitle ?? t("count.tracks", { count: collection.tracks.length })}</span>
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
  const [params, setParams] = useSearchParams();
  // La pochette locale arrive avec la racine des transferts (`rootReady`).
  const model = useMemo(
    () => deviceModel(kept.tracks, kept.collections, rootReady ? localResourceUrl : () => null, { completeOnly: offline }),
    [kept.tracks, kept.collections, offline, rootReady],
  );
  const open = model.collections.find((c) => c.key === params.get("c")) ?? null;
  const tracks = open?.tracks ?? model.tracks;
  const rows = useMemo(() => rowsOf(tracks), [tracks]);
  const contextId = open ? `${DEVICE_CONTEXT}:${open.key}` : DEVICE_CONTEXT;
  const size = formatBytes(keptBytes(kept.tracks));
  const meta = t("view.summary", { tracks: tm("count.tracks", { count: tracks.length }), size });

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
        artworkUrl={open?.artworkUrl ?? null}
        art={open ? undefined : <DeviceArt />}
        meta={kept.loaded ? <span>{open ? tm("count.tracks", { count: tracks.length }) : meta}</span> : null}
        canPlay={tracks.length > 0}
        onPlay={() => player.playList(tracks, 0, contextId)}
        onShuffle={() => queueActions.playShuffled(player, tracks, contextId)}
        extra={open ? <KeepCollectionButton kind={open.kind} collectionKey={open.key.slice(open.key.indexOf(":") + 1)} title={open.title} subtitle={open.subtitle} tracks={open.tracks} /> : undefined}
      />
      <div className="flex flex-col gap-8 px-2 md:px-6">
        {offline && (
          <p className="mx-2 flex items-center gap-2 rounded-xl bg-fill-subtle px-4 py-3 text-sm text-content-secondary" role="status">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            {t("view.offlineHint")}
          </p>
        )}
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
                <CollectionCard key={c.key} collection={c} onOpen={() => setParams({ c: c.key })} />
              ))}
            </CardGrid>
          </Shelf>
        )}
        {rows.length > 0 && (
          <section className="flex flex-col gap-3">
            {!open && <h2 className="oc-heading px-2 text-xl text-content-primary">{t("view.tracks")}</h2>}
            <TrackList rows={rows} contextId={contextId} showArtwork showAlbum={!open} label={open?.title ?? t("view.title")} />
          </section>
        )}
      </div>
    </div>
  );
}
