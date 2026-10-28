import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MusicPlaylistEntry, MusicTrack } from "@tentacle-tv/shared/music";
import type { ListRow } from "@tentacle-tv/shared/octave";
import { libraryTrack } from "@tentacle-tv/shared/octave/testing";
import type { DeviceCollection } from "./deviceModel";

/**
 * Octave — une playlist ouverte dans « Sur cet appareil » : les rangées de la playlist EN LIGNE (cache compris) et la
 * préférence de SA liste ; un album, son ordre gardé — jamais le tri des likés.
 */
const h = vi.hoisted(() => ({ entries: undefined as MusicPlaylistEntry[] | undefined, listKey: "unset" as string | null, playlistId: "unset" as string | null | undefined }));

vi.mock("@tentacle-tv/api-client", () => ({
  useMusicPlaylist: (id: string | null) => {
    h.playlistId = id;
    return { data: h.entries ? { entries: h.entries } : undefined };
  },
}));
vi.mock("../pending/usePendingMusic", () => ({ usePendingMusic: () => [] }));
vi.mock("../library/useLibraryFirstRows", () => ({ useLibraryFirstRows: (rows: readonly ListRow[]) => rows }));
vi.mock("../listOrder/useListOrder", () => ({
  // Le tri du compte : à l'envers, pour voir qu'il s'applique (ou non).
  useListOrder: (key: string | null, natural: readonly ListRow[]) => {
    h.listKey = key;
    return { capable: true, ready: true, rows: [...natural].reverse() };
  },
}));

const { useKeptListRows } = await import("./useKeptListRows");

const [a, b, c] = ["a", "b", "c"].map((id) => libraryTrack(id)) as [MusicTrack, MusicTrack, MusicTrack];
const collection = (key: string, kind: "album" | "playlist", tracks: MusicTrack[]): DeviceCollection => ({
  key, kind, title: "X", subtitle: null, artworkUrl: null, tracks, keys: tracks.map((t) => t.key),
});
const entry = (track: MusicTrack, position: number): MusicPlaylistEntry => ({ entryId: `e-${track.key}`, position, track });

let result: ReturnType<typeof useKeptListRows> | null = null;
function Probe({ open }: { open: DeviceCollection | null }) {
  result = useKeptListRows(open);
  return null;
}
const run = (open: DeviceCollection | null) => {
  renderToStaticMarkup(<Probe open={open} />);
  return result!;
};

beforeEach(() => {
  h.entries = undefined;
  h.listKey = "unset";
});

describe("les rangées d'une collection gardée ouverte", () => {
  it("une playlist de la bibliothèque : l'ordre EN LIGNE, et la préférence de SA liste", () => {
    h.entries = [entry(a, 0), entry(b, 1), entry(c, 2)];
    const out = run(collection("playlist:jf:0123456789abcdef0123456789abcdef", "playlist", [c, b, a]));
    expect(h.playlistId).toBe("0123456789abcdef0123456789abcdef");
    expect(out.natural.map((r) => r.rowKey)).toEqual([`e-${a.key}`, `e-${b.key}`, `e-${c.key}`]);
    expect(h.listKey).toBe("playlist:0123456789abcdef0123456789abcdef");
    expect(out.rows.map((r) => r.track.key)).toEqual([c.key, b.key, a.key]);
    expect(out.toolbar).toBe(true);
  });

  it("rien en ligne ni en cache : l'ordre de la collection gardée", () => {
    const out = run(collection("playlist:jf:0123456789abcdef0123456789abcdef", "playlist", [c, a]));
    expect(out.natural.map((r) => r.track.key)).toEqual([c.key, a.key]);
  });

  it("un album : son ordre gardé, sans barre ni tri (le tri par défaut serait celui des likés)", () => {
    const out = run(collection("album:x", "album", [b, a, c]));
    expect(h.playlistId).toBeNull();
    expect(h.listKey).toBeNull();
    expect(out.rows.map((r) => r.track.key)).toEqual([b.key, a.key, c.key]);
    expect(out.toolbar).toBe(false);
    expect(out.ready).toBe(true);
  });
});
