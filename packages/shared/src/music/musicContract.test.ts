import { describe, expect, it } from "vitest";
import { externalTrackKey, libraryTrackKey, normalizeMbid, parseTrackKey } from "./musicKeys";
import { readPluginMusicManifest } from "./pluginMusicContract";
import { MUSIC_RIGHTS_BEFORE, readMusicRights } from "./musicRights";
import { hasMoods, readMusicMoods } from "./musicMoods";

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
    const m = readPluginMusicManifest({ search: "/music/search", resolve: "/music/resolve", playlist: "/music/playlist", typingPause: "/music/warm/typing", searchKinds: ["playlists", "tracks", "videos", 3, "tracks"] });
    expect(m?.playlist).toBe("/music/playlist");
    expect(m?.typingPause).toBe("/music/warm/typing");
    expect(readPluginMusicManifest({ search: "/music/search", resolve: "/music/resolve", radio: "/music/radio" })?.radio).toBe("/music/radio");
    expect(m?.searchKinds).toEqual(["tracks", "playlists"]);
    // Rien de connu : pas de filtres servis (l'interface filtre la page « Tout »).
    expect(readPluginMusicManifest({ search: "/music/search", resolve: "/music/resolve", searchKinds: ["videos"] })?.searchKinds).toBeUndefined();
    expect(readPluginMusicManifest({ search: "/music/search", resolve: "/music/resolve", playlist: "../x", searchKinds: "tracks" })).toEqual({ search: "/music/search", resolve: "/music/resolve" });
  });
});

describe("droits du compte (route `rights`)", () => {
  it("le manifeste garde `rights` ; une extension d'avant n'en a pas", () => {
    expect(readPluginMusicManifest({ search: "/s", resolve: "/r", rights: "/music/me/rights" })?.rights).toBe("/music/me/rights");
    expect(readPluginMusicManifest({ search: "/s", resolve: "/r" })?.rights).toBeUndefined();
  });

  it("readMusicRights valide la forme, sinon rien (le client garde le comportement d'avant)", () => {
    const ok = { acquire: true, dailyLimit: 10, remainingToday: 3, keepOffline: false, resetsAt: 1_800_000_000_000 };
    expect(readMusicRights(ok)).toEqual(ok);
    expect(readMusicRights({ ...ok, dailyLimit: 0, remainingToday: null, resetsAt: null })?.remainingToday).toBeNull();
    expect(readMusicRights({ ...ok, acquire: "oui" })).toBeNull();
    expect(readMusicRights({ ...ok, remainingToday: -1 })).toBeNull();
    expect(readMusicRights(null)).toBeNull();
    expect(MUSIC_RIGHTS_BEFORE.acquire).toBe(true);
  });
});

describe("ambiances (points `moods` et `mood`)", () => {
  it("le manifeste garde les deux ; hasMoods exige les deux", () => {
    const both = readPluginMusicManifest({ search: "/s", resolve: "/r", moods: "/music/moods", mood: "/music/mood" });
    expect(both?.moods).toBe("/music/moods");
    expect(hasMoods(both)).toBe(true);
    expect(hasMoods(readPluginMusicManifest({ search: "/s", resolve: "/r", moods: "/music/moods" }))).toBe(false);
    expect(hasMoods(readPluginMusicManifest({ search: "/s", resolve: "/r" }))).toBe(false);
    expect(hasMoods(null)).toBe(false);
  });

  it("readMusicMoods écarte ce qui n'a pas la forme, garde le reste", () => {
    const ok = { id: "chill", name: "Détente", color: "#3A7BD5", artworkUrl: null, keywords: ["Chill", "relax", 4] };
    const moods = readMusicMoods({ moods: [ok, { ...ok, id: "../x" }, { ...ok, id: "focus", color: "bleu" }, ok, { ...ok, id: "party", name: "" }] });
    expect(moods).toEqual([{ id: "chill", name: "Détente", color: "#3a7bd5", artworkUrl: null, keywords: ["détente", "chill", "relax"] }]);
    expect(readMusicMoods(null)).toEqual([]);
    expect(readMusicMoods({ moods: "x" })).toEqual([]);
  });
});
