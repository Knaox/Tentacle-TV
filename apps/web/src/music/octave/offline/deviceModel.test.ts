import { describe, expect, it } from "vitest";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { deviceModel, keptToTrack } from "./deviceModel";

function kept(key: string, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: 1, itemId: key.replace("jf:", ""), trackKey: key, origin: "library", variant: "original", preset: null, status: "complete", errorCode: null,
    pausedByUser: false, bytesDone: 1, expectedSize: 1, title: `Titre ${key}`, artist: "Artiste", album: "Album", albumKey: null,
    discNumber: 1, trackNumber: 1, durationMs: 1000, coverRel: null, sourcePath: null, trackJson: "{}", createdAt: 0, ...partial,
  };
}
const local = (rel: string) => `tentacle://local/${rel}?t=local`;

describe("deviceModel", () => {
  it("relit la fiche gardée et pose la pochette LOCALE", () => {
    const json = JSON.stringify({ key: "jf:a", title: "Vrai titre", artworkUrl: "/api/music/artwork/a", artists: [] });
    const track = keptToTrack(kept("jf:a", { trackJson: json, coverRel: "media/a/cover.jpg" }), local);
    expect(track.title).toBe("Vrai titre");
    expect(track.artworkUrl).toBe("tentacle://local/media/a/cover.jpg?t=local");
  });

  it("une fiche illisible se refait des colonnes, sans réseau", () => {
    const track = keptToTrack(kept("jf:a", { trackJson: "pas du json" }), local);
    expect(track).toMatchObject({ key: "jf:a", title: "Titre jf:a", artists: [{ name: "Artiste" }], album: { title: "Album" }, availability: "library" });
  });

  it("les collections gardent leur ordre ; hors ligne, seulement ce qui est complet", () => {
    const tracks = [kept("jf:a"), kept("jf:b", { status: "downloading" }), kept("jf:c")];
    const collections = [{ key: "album:x", kind: "album" as const, title: "X", subtitle: null, coverItemId: null, trackKeys: ["jf:c", "jf:b", "jf:a"], updatedAt: 1 }];
    const online = deviceModel(tracks, collections, local, { completeOnly: false });
    expect(online.collections[0]!.tracks.map((t) => t.key)).toEqual(["jf:c", "jf:b", "jf:a"]);
    const offline = deviceModel(tracks, collections, local, { completeOnly: true });
    expect(offline.tracks.map((t) => t.key)).toEqual(["jf:a", "jf:c"]);
    expect(offline.collections[0]!.tracks.map((t) => t.key)).toEqual(["jf:c", "jf:a"]);
  });

  it("un titre RENOMMÉ depuis qu'il a été gardé reste à sa place dans sa playlist (Damien, 28/10 : « une copie »)", () => {
    const old = kept("ext:sillon:imp:b", { origin: "external", fileId: 2 });
    const tracks = [kept("jf:a"), old, kept("jf:c", { fileId: 3 })];
    const collections = [{ key: "playlist:jf:p", kind: "playlist" as const, title: "New", subtitle: null, coverItemId: null, trackKeys: ["jf:a", "ext:sillon:ytm:t:b", "jf:c"], updatedAt: 1 }];
    // Sans les renommages : le titre disparaissait de la playlist gardée.
    expect(deviceModel(tracks, collections, local, { completeOnly: true }).collections[0]!.keys).toEqual(["jf:a", "jf:c"]);
    const renames = new Map(tracks.map((t) => [t.trackKey, t]));
    renames.set("ext:sillon:ytm:t:b", old);
    const model = deviceModel(tracks, collections, local, { completeOnly: true, resolve: (key) => renames.get(key) });
    expect(model.collections[0]!.keys).toEqual(["jf:a", "ext:sillon:ytm:t:b", "jf:c"]);
    expect(model.collections[0]!.tracks[1]!.key).toBe("ext:sillon:imp:b");
    // Une copie pas encore complète, hors ligne : pas là, même renommée.
    const partial = deviceModel([kept("jf:a"), { ...old, status: "downloading" }], collections, local, { completeOnly: true, resolve: (key) => (key === "ext:sillon:ytm:t:b" ? { ...old, status: "downloading" } : undefined) });
    expect(partial.collections[0]!.keys).toEqual(["jf:a"]);
  });
});
