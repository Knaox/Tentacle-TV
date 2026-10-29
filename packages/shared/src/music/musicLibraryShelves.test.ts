import { describe, expect, it } from "vitest";
import type { ExternalMusicPlaylist } from "./pluginMusicContract";
import { parseShelfOrder, parseShelfSection, shelfKeyOf, shelfListKey, shelfPlaylistKey, type MusicShelfExternalPlaylist } from "./musicLibraryShelves";

describe("musicLibraryShelves", () => {
  it("la clé : jf:<id> normalisé, sinon ext:<extension>:<id>", () => {
    expect(shelfKeyOf({ jellyfinId: "AB-cd" })).toBe("jf:abcd");
    expect(shelfKeyOf({ jellyfinId: null, external: { pluginId: "sillon", id: "x:1" } })).toBe("ext:sillon:x:1");
    expect(shelfPlaylistKey({ kind: "external", playlist: { key: "k", external: { pluginId: "p", id: "1" }, title: "", owner: null, trackCount: null, artworkUrl: null } })).toBe("ext:p:1");
  });
  it("rubriques et ordre reçus", () => {
    expect(parseShelfSection("albums")).toBe("albums");
    expect(parseShelfSection("tracks")).toBeNull();
    expect(parseShelfOrder({ keys: ["a", "b", "a"] })).toEqual(["a", "b"]);
    expect(parseShelfOrder({ keys: [""] })).toBeNull();
    expect(parseShelfOrder({ keys: "a" })).toBeNull();
    expect(parseShelfOrder(null)).toBeNull();
    expect(shelfListKey("playlists")).toBe("library:playlists");
  });
  it("une playlist d'extension se garde telle quelle (même forme, sans titres)", () => {
    const external: ExternalMusicPlaylist = { key: "k", external: { pluginId: "p", id: "1" }, title: "T", owner: null, trackCount: 3, artworkUrl: null };
    const kept: MusicShelfExternalPlaylist = external;
    expect(kept.title).toBe("T");
  });
});
