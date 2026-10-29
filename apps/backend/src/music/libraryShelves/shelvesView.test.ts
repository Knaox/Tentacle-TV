/**
 * Les favoris d'une extension : montrés tant qu'elle sert ; coupée ou retirée, ils ne paraissent plus (ni dans la
 * bibliothèque, ni donc à l'accueil) mais restent en base, et reviennent avec elle.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ usable: ["sillon"] as string[] }));
const external = (pluginId: string) => ({ pluginId, id: "1" });

vi.mock("../../services/pluginStorage/gate", () => ({ usablePlugins: () => state.usable.map((pluginId) => ({ pluginId, enabled: true })) }));
vi.mock("../view/viewContext", () => ({ visibleInOrder: async () => [], albumsOf: async () => [], artistsOf: () => [] }));
vi.mock("../view/playlistViews", () => ({ playlistsView: async () => [] }));
vi.mock("../listOrder/shelfOrderStore", () => ({ readShelfOrder: async () => [] }));
vi.mock("./shelfFavoriteStore", () => ({
  listShelfFavorites: async () => [
    { section: "albums", itemKey: "ext:sillon:1", snapshotJson: JSON.stringify({ external: external("sillon"), title: "Discovery" }) },
    { section: "playlists", itemKey: "ext:sillon:1", snapshotJson: JSON.stringify({ external: external("sillon"), title: "Été" }) },
    { section: "artists", itemKey: "ext:other:1", snapshotJson: JSON.stringify({ external: external("other"), name: "X" }) },
  ],
}));

import { shelvesView } from "./shelvesView";

const view = { userId: "1".repeat(32), access: { mode: "all" as const, libraryId: "lib" }, favorites: new Set<string>() };

beforeEach(() => {
  state.usable = ["sillon"];
});

describe("favoris d'une extension", () => {
  it("l'extension sert : ses favoris sont là ; une autre, retirée : rien d'elle", async () => {
    const shelves = await shelvesView(view);
    expect(shelves.albums.map((a) => a.title)).toEqual(["Discovery"]);
    expect(shelves.playlists.map((p) => p.kind)).toEqual(["external"]);
    expect(shelves.artists).toEqual([]);
  });
  it("coupée : plus rien d'elle — et rallumée, tout revient (rien n'a été effacé)", async () => {
    state.usable = [];
    const off = await shelvesView(view);
    expect([off.albums, off.artists, off.playlists]).toEqual([[], [], []]);
    state.usable = ["sillon", "other"];
    const back = await shelvesView(view);
    expect(back.albums).toHaveLength(1);
    expect(back.artists.map((a) => a.name)).toEqual(["X"]);
  });
});
