import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { KeptMusicCollection, KeptMusicTrack } from "@tentacle-tv/offline-core";
import { libraryTrack } from "@tentacle-tv/shared/octave/testing";
import { NO_MUSIC_OFFLINE, type MusicOfflineSurface } from "./keepRules";
import { OfflineSurfaceContext } from "./offlineSurfaceContext";

/**
 * Octave — la place d'un album ou d'une playlist gardés, dans leur en-tête (Damien, 28/10 : « on ne sait pas combien
 * de place prennent les titres ») : seulement gardés en entier, le glyphe une fois tout là.
 */
const h = vi.hoisted(() => ({ byKey: new Map<string, unknown>(), collections: [] as unknown[] }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: { size?: string }) => (options?.size ? `${key}[${options.size}]` : key) }),
}));
vi.mock("./useKeptMusic", () => ({ useKeptMusic: () => ({ byKey: h.byKey, collections: h.collections }) }));
vi.mock("../components/CollectionHeader", () => ({ Dot: () => <span data-dot /> }));

const { KeptSizeMeta } = await import("./KeptSizeMeta");

const tracks = ["a", "b"].map((id) => libraryTrack(id));
function copy(key: string, fileId: number, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId, itemId: key, trackKey: key, origin: "library", variant: "original", preset: null, status: "complete", errorCode: null,
    pausedByUser: false, bytesDone: 3 * 1024 * 1024, expectedSize: null, title: key, artist: null, album: null, albumKey: null,
    discNumber: null, trackNumber: null, durationMs: null, coverRel: null, sourcePath: null, trackJson: "{}", createdAt: 0,
    ...partial,
  };
}
const whole: KeptMusicCollection = { key: "playlist:jf:p1", kind: "playlist", title: "New", subtitle: null, coverItemId: null, trackKeys: ["jf:a", "jf:b"], updatedAt: 0 };
const VISIBLE: MusicOfflineSurface = { visible: true, library: true, externalFrom: null };
const render = (surface: MusicOfflineSurface = VISIBLE) =>
  renderToStaticMarkup(
    <OfflineSurfaceContext.Provider value={surface}>
      <KeptSizeMeta kind="playlist" collectionKey="jf:p1" tracks={tracks} />
    </OfflineSurfaceContext.Provider>,
  );

beforeEach(() => {
  h.byKey = new Map([["jf:a", copy("jf:a", 1)], ["jf:b", copy("jf:b", 2)]]);
  h.collections = [whole];
});

describe("la place d'une collection gardée, dans son en-tête", () => {
  it("gardée en entier : « 6 Mio sur cet appareil », le glyphe de réussite", () => {
    const html = render();
    expect(html).toContain("size.onDevice[6 Mio]");
    expect(html).toContain("text-status-success-fg");
    expect(html).toContain("data-dot");
  });

  it("en préparation : la place déjà prise, sans le glyphe", () => {
    h.byKey.set("jf:b", copy("jf:b", 2, { status: "downloading", bytesDone: 1024 * 1024 }));
    const html = render();
    expect(html).toContain("size.onDevice[4 Mio]");
    expect(html).not.toContain("text-status-success-fg");
  });

  it("pas gardée en entier (un titre gardé par ailleurs) : rien", () => {
    h.collections = [];
    h.byKey.delete("jf:b");
    expect(render()).toBe("");
  });

  it("hors de la portée du hors ligne : rien", () => {
    expect(render(NO_MUSIC_OFFLINE)).toBe("");
  });
});
