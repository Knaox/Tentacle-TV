import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";

/**
 * Octave — « Sur cet appareil » dit la place (Damien, 28/10) : en tête, tout ce qui est gardé et l'espace libre du
 * disque quand la coquille le dit ; sur chaque album et playlist ; sur celui qu'on ouvre. Et la bascule hors ligne
 * à sa place : la capsule en ligne, l'avis hors ligne.
 */
const MIB = 1024 * 1024;
const h = vi.hoisted(() => ({
  params: "",
  offline: false,
  free: null as number | null,
  tracks: [] as unknown[],
  collections: [] as unknown[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { size?: string; count?: number }) =>
      options?.size ? `${key}[${options.size}]` : options?.count !== undefined ? `${key}[${options.count}]` : key,
  }),
}));
vi.mock("react-router-dom", () => ({ useSearchParams: () => [new URLSearchParams(h.params), () => undefined] }));
vi.mock("../../../downloads/localFiles", () => ({ localResourceUrl: () => null, useDownloadsRootReady: () => false }));
vi.mock("../../../downloads/useDownloadState", () => ({ useDiskInfo: () => ({ freeBytes: h.free, usedBytes: null }) }));
vi.mock("../../../offline/useOfflineMode", () => ({ useOfflineMode: () => h.offline }));
vi.mock("../components/Artwork", () => ({ Artwork: () => <i data-artwork />, ARTWORK_RADIUS: { lg: 8 } }));
vi.mock("../components/Cards", () => ({
  CardGrid: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Shelf: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));
vi.mock("../components/CollectionHeader", () => ({
  CollectionHeader: ({ meta, extra }: { meta?: ReactNode; extra?: ReactNode }) => (
    <header>
      <div data-meta>{meta}</div>
      {extra}
    </header>
  ),
}));
vi.mock("../components/TrackList", () => ({ rowsOf: (tracks: unknown[]) => tracks, TrackList: () => <i data-tracks /> }));
vi.mock("../components/ViewStates", () => ({ EmptyState: () => <i data-empty /> }));
vi.mock("../player/OctavePlayerProvider", () => ({ useOctavePlayer: () => ({}) }));
vi.mock("./KeepCollectionButton", () => ({ KeepCollectionButton: () => <i data-keep /> }));
vi.mock("./OfflineSwitch", () => ({ OfflineNotice: () => <i data-notice />, OfflineSwitchButton: () => <i data-switch /> }));
vi.mock("./autosync/AutoSyncSetting", () => ({ AutoSyncSetting: () => <i data-autosync /> }));
vi.mock("../listOrder/ListToolbar", () => ({ ListToolbar: ({ shown, total }: { shown: number; total: number }) => <i data-toolbar={`${shown}/${total}`} /> }));
vi.mock("../listOrder/NoMatch", () => ({ NoMatch: () => <i data-no-match /> }));
// Les rangées d'une collection ouverte ont leurs propres tests (`keptPlaylistRows`) : ici, l'ordre gardé tel quel.
vi.mock("./useKeptListRows", () => ({
  useKeptListRows: (open: { keys: string[]; tracks: unknown[] } | null) => {
    const rows = open ? open.keys.map((key, i) => ({ rowKey: key, track: open.tracks[i], pending: null, entryId: null })) : [];
    return { natural: rows, rows, order: { reset: () => undefined }, toolbar: true, ready: true };
  },
}));
vi.mock("./useKeptMusic", () => ({
  useKeptMusic: () => ({
    loaded: true,
    tracks: h.tracks,
    collections: h.collections,
    byKey: new Map((h.tracks as KeptMusicTrack[]).map((k) => [k.trackKey, k])),
  }),
}));

const { DeviceView } = await import("./DeviceView");

function copy(key: string, fileId: number, bytes: number): KeptMusicTrack {
  return {
    fileId, itemId: key, trackKey: key, origin: "external", variant: "original", preset: null, status: "complete", errorCode: null,
    pausedByUser: false, bytesDone: bytes, expectedSize: bytes, title: key, artist: null, album: null, albumKey: null,
    discNumber: null, trackNumber: null, durationMs: null, coverRel: null, sourcePath: null, trackJson: "{}", createdAt: 0,
  };
}
const playlist: KeptMusicCollection = { key: "playlist:jf:p1", kind: "playlist", title: "New", subtitle: null, coverItemId: null, trackKeys: ["a", "b"], updatedAt: 0 };
const metaOf = (html: string) => /<div data-meta="[^"]*">(.*?)<\/div>/.exec(html)?.[1] ?? "";

beforeEach(() => {
  h.params = "";
  h.offline = false;
  h.free = 230 * 1024 * MIB;
  h.tracks = [copy("a", 1, 4 * MIB), copy("b", 2, 6 * MIB), copy("c", 3, 2 * MIB)];
  h.collections = [playlist];
});

describe("« Sur cet appareil » dit la place", () => {
  it("en tête : les titres, la place occupée, l'espace libre", () => {
    const html = renderToStaticMarkup(<DeviceView />);
    expect(metaOf(html)).toContain("count.tracks[3] · view.used[12 Mio] · view.free[230 Gio]");
  });

  it("l'espace libre inconnu (la coquille ne le dit pas) : le reste seulement", () => {
    h.free = null;
    expect(metaOf(renderToStaticMarkup(<DeviceView />))).toContain("count.tracks[3] · view.used[12 Mio]<");
  });

  it("chaque playlist gardée dit sa place ; ouverte, la sienne seulement", () => {
    expect(renderToStaticMarkup(<DeviceView />)).toContain("count.tracks[2] · 10 Mio");
    h.params = "c=playlist:jf:p1";
    expect(metaOf(renderToStaticMarkup(<DeviceView />))).toContain("count.tracks[2] · 10 Mio<");
  });

  it("une playlist ouverte : la barre de la playlist en ligne (recherche, filtres, tris) au-dessus de ses titres", () => {
    h.params = "c=playlist:jf:p1";
    const html = renderToStaticMarkup(<DeviceView />);
    expect(html).toContain('data-toolbar="2/2"');
    expect(html).toContain("data-tracks");
  });

  it("en ligne, la capsule « Passer hors ligne » ; hors ligne, l'avis qui porte la sortie", () => {
    const online = renderToStaticMarkup(<DeviceView />);
    expect(online).toContain("data-switch");
    expect(online).not.toContain("data-notice");
    h.offline = true;
    expect(renderToStaticMarkup(<DeviceView />)).toContain("data-notice");
  });
});
