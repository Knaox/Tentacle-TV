/**
 * Sans doublon : un élément indexé à l'avance (après un `refreshPath`) est
 * annoncé UNE fois ; quand le `LibraryChanged` de Jellyfin le redit ensuite,
 * l'index se met à jour en silence (ni `music:library` updated, ni
 * `jellyfin.audioItems` updated). Une vraie mise à jour, plus tard, se dit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLibraryChange } from "./indexSync";
import { resetRecentArrivalsForTests } from "./recentArrivals";

const ID = "a".repeat(32);

const { state } = vi.hoisted(() => ({ state: { known: new Set<string>(), published: [] as unknown[], upserts: 0 } }));

vi.mock("../jellyfin/musicLibrary", () => ({ getMusicLibrary: async () => ({ libraryId: "lib", name: "Musique", paths: ["/music"] }) }));
vi.mock("../../services/jellyfinLibrary", () => ({ adminUserParam: async () => "" }));
vi.mock("../../services/configStore", () => ({ setConfigValue: async () => undefined }));
vi.mock("../jellyfin/musicJellyfin", async (original) => ({
  ...(await original<typeof import("../jellyfin/musicJellyfin")>()),
  jfAdmin: async () => ({
    ok: true,
    data: { Items: [{ Id: ID, Type: "Audio", Name: "Nouvelle venue", Path: "/music/A/B/01.flac", ProviderIds: { MusicBrainzRecording: "0c7a0e00-0000-4000-800d-000000000901" } }] },
  }),
}));
vi.mock("./indexQueries", () => ({
  rowsByIds: async (ids: string[]) => new Map(ids.filter((id) => state.known.has(id)).map((id) => [id, { id, kind: "track" }])),
  albumTracks: async () => [],
  orderedIds: async () => [],
}));
vi.mock("./indexStore", () => ({
  upsertRows: async (rows: { id: string }[]) => {
    state.upserts++;
    for (const row of rows) state.known.add(row.id);
  },
  removeRows: async () => [],
  currentGeneration: async () => 1,
  dropOlderThan: async () => [],
}));
vi.mock("./artistMbids", () => ({ fillArtistMbids: async () => 0 }));
vi.mock("../access/musicAccess", () => ({ invalidateMusicVisibility: () => undefined }));
vi.mock("../events/audioItemsFeed", () => ({ publishAudioItems: (change: unknown) => state.published.push(change) }));

beforeEach(() => {
  resetRecentArrivalsForTests();
  state.known.clear();
  state.published.length = 0;
  state.upserts = 0;
});

describe("indexé à l'avance, puis LibraryChanged", () => {
  it("annoncé une fois en « ajouté », puis mis à jour en silence", async () => {
    const first = await applyLibraryChange([ID], [], []);
    expect(first?.added.map((r) => r.id)).toEqual([ID]);
    expect(first?.addedRefs.map((r) => r.jellyfinId)).toEqual([ID]);

    const second = await applyLibraryChange([ID], [ID], []);
    expect(second?.added).toEqual([]);
    expect(second?.updated).toEqual([]);
    expect(second?.updatedRefs).toEqual([]);
    expect(state.upserts).toBe(2);
    expect(state.published).toEqual([
      { added: [expect.objectContaining({ jellyfinId: ID })], updated: [], removed: [] },
      { added: [], updated: [], removed: [] },
    ]);
  });

  it("au-delà de deux minutes, une mise à jour se dit comme avant", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    await applyLibraryChange([ID], [], []);
    vi.setSystemTime(1_000_000 + 3 * 60_000);
    const later = await applyLibraryChange([], [ID], []);
    expect(later?.updated.map((r) => r.id)).toEqual([ID]);
    vi.useRealTimers();
  });
});
