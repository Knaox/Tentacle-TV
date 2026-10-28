import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { MusicAlbum } from "@tentacle-tv/shared/music";
import { WARM_FETCH_PER_MINUTE } from "@tentacle-tv/shared/octave";
import type { MusicProvider } from "../../pluginMusic/musicProvider";
import { INTENT_PER_MINUTE, prefetchExternalEntity, resetEntityWarmupForTests, takeIntentSlot, warmModeOf, warmVisibleAlbums } from "./entityWarmup";
import { externalEntityKey } from "./useMusicEntities";

const requests = vi.hoisted(() => ({ album: vi.fn(), prefetch: vi.fn() }));
vi.mock("../../pluginMusic/musicRequests", () => ({
  fetchExternalAlbum: (_p: unknown, id: string) => {
    requests.album(id);
    return Promise.resolve({ key: `ext:sillon:${id}`, tracks: [] });
  },
  fetchExternalArtist: () => Promise.resolve(null),
  prefetchMusic: (_p: unknown, ids: string[], intent: string) => requests.prefetch(ids, intent),
}));

const provider = (extra: Partial<MusicProvider["music"]> = {}): MusicProvider =>
  ({ pluginId: "sillon", music: { search: "/s", resolve: "/r", album: "/music/album", ...extra } }) as unknown as MusicProvider;
const album = (id: string): MusicAlbum => ({ key: `ext:sillon:${id}`, jellyfinId: null, external: { pluginId: "sillon", id } }) as MusicAlbum;
const albums = Array.from({ length: 20 }, (_, i) => album(`a${i}`));

beforeEach(() => {
  resetEntityWarmupForTests();
  requests.album.mockReset();
  requests.prefetch.mockReset();
});

describe("intention sur une carte (survol, appui commencé)", () => {
  it(`${INTENT_PER_MINUTE} par minute glissante, puis plus rien jusqu'à ce que la fenêtre avance`, () => {
    const t0 = 1_000_000;
    const granted = Array.from({ length: INTENT_PER_MINUTE + 5 }, (_, i) => takeIntentSlot(t0 + i * 100)).filter(Boolean).length;
    expect(granted).toBe(INTENT_PER_MINUTE);
    expect(takeIntentSlot(t0 + 59_000)).toBe(false);
    expect(takeIntentSlot(t0 + 60_001)).toBe(true);
  });

  it("demande la vue d'un album hors bibliothèque, jamais deux fois tant qu'elle est fraîche", async () => {
    const qc = new QueryClient();
    expect(prefetchExternalEntity(qc, provider(), "album", "ext:sillon:x")).toBe(true);
    await vi.waitFor(() => expect(qc.getQueryData(externalEntityKey("album", "ext:sillon:x"))).toBeTruthy());
    expect(prefetchExternalEntity(qc, provider(), "album", "ext:sillon:x")).toBe(false);
    expect(prefetchExternalEntity(qc, provider(), "album", "jf-123")).toBe(false);
    expect(prefetchExternalEntity(qc, provider(), "album", "ext:autre:x")).toBe(false);
    expect(requests.album).toHaveBeenCalledTimes(1);
  });
});

describe("albums vus défiler", () => {
  it("sans vue d'album chez l'extension : rien", () => {
    expect(warmModeOf(provider({ album: undefined }))).toBeNull();
    expect(warmVisibleAlbums(new QueryClient(), provider({ album: undefined }), albums)).toEqual([]);
  });

  it("extension qui prépare des albums : UN signal de fond, aucune vue demandée", () => {
    const p = provider({ prefetch: "/music/prefetch", prefetchAlbums: true });
    expect(warmModeOf(p)).toBe("signal");
    warmVisibleAlbums(new QueryClient(), p, albums.slice(0, 5), 0);
    expect(requests.prefetch).toHaveBeenCalledWith(["a0", "a1", "a2", "a3", "a4"], "albums");
    expect(requests.album).not.toHaveBeenCalled();
  });

  it("repli : une vue par arrêt, plafonnée à la minute, jamais un album déjà en cache", () => {
    const qc = new QueryClient();
    qc.setQueryData(externalEntityKey("album", "ext:sillon:a0"), { key: "ext:sillon:a0" });
    const p = provider({ prefetch: "/music/prefetch" });
    expect(warmModeOf(p)).toBe("fetch");
    for (let s = 0; s < 10; s++) warmVisibleAlbums(qc, p, albums, 1_000 * s);
    expect(requests.album).toHaveBeenCalledTimes(WARM_FETCH_PER_MINUTE);
    expect(requests.album).not.toHaveBeenCalledWith("a0");
    expect(requests.prefetch).not.toHaveBeenCalled();
  });
});
