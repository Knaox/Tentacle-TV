import { describe, expect, it } from "vitest";
import { externalTrackKey, libraryTrackKey, normalizeMbid, parseTrackKey } from "./musicKeys";
import { readPluginMusicManifest } from "./pluginMusicContract";

describe("clés de titre", () => {
  it("aller-retour bibliothèque et extension", () => {
    expect(parseTrackKey(libraryTrackKey("abc123"))).toEqual({ kind: "library", jellyfinId: "abc123" });
    const key = externalTrackKey({ pluginId: "music-sources", id: "rec:1~rel:2" });
    expect(parseTrackKey(key)).toEqual({ kind: "external", ref: { pluginId: "music-sources", id: "rec:1~rel:2" } });
  });
  it("refuse une clé mal formée sans lever", () => {
    expect(parseTrackKey("ext::x")).toBeNull();
    expect(parseTrackKey("jf:../x")).toBeNull();
    expect(parseTrackKey("autre")).toBeNull();
  });
  it("normalise un MBID", () => {
    expect(normalizeMbid(" 5B11F4CE-A62D-471E-81FC-A69A8278C7DA ")).toBe("5b11f4ce-a62d-471e-81fc-a69a8278c7da");
    expect(normalizeMbid("pas-un-mbid")).toBeNull();
  });
});

describe("manifeste music", () => {
  it("exige search et resolve, garde les chemins sûrs", () => {
    expect(readPluginMusicManifest({ search: "/music/search" })).toBeNull();
    const m = readPluginMusicManifest({ search: "/music/search", resolve: "/music/resolve", like: "//x", pending: "/music/pending", labels: { fr: "Hors bibliothèque", xx1: "?" } });
    expect(m).toEqual({ search: "/music/search", resolve: "/music/resolve", pending: "/music/pending", labels: { fr: "Hors bibliothèque" } });
  });

  it("la vue playlist et les filtres de recherche : chemin sûr, liste FERMÉE dans l'ordre du contrat", () => {
    const m = readPluginMusicManifest({ search: "/music/search", resolve: "/music/resolve", playlist: "/music/playlist", searchKinds: ["playlists", "tracks", "videos", 3, "tracks"] });
    expect(m?.playlist).toBe("/music/playlist");
    expect(m?.searchKinds).toEqual(["tracks", "playlists"]);
    // Rien de connu : pas de filtres servis (l'interface filtre la page « Tout »).
    expect(readPluginMusicManifest({ search: "/music/search", resolve: "/music/resolve", searchKinds: ["videos"] })?.searchKinds).toBeUndefined();
    expect(readPluginMusicManifest({ search: "/music/search", resolve: "/music/resolve", playlist: "../x", searchKinds: "tracks" })).toEqual({ search: "/music/search", resolve: "/music/resolve" });
  });
});
