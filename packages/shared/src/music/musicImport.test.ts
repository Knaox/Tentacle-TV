import { describe, expect, it } from "vitest";
import { absentPositions, recognizeImportUrl } from "./musicImport";
import { readPluginMusicManifest } from "./pluginMusicContract";
import { importBatchesOf, MUSIC_IMPORT_BATCH } from "./musicImportExtension";

describe("recognizeImportUrl — la liste fermée des liens", () => {
  it.each([
    ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc", "spotify", "playlist", "37i9dQZF1DXcBWIGoYBM5M"],
    ["https://open.spotify.com/intl-fr/playlist/37i9dQZF1DXcBWIGoYBM5M", "spotify", "playlist", "37i9dQZF1DXcBWIGoYBM5M"],
    ["https://open.spotify.com/embed/album/4aawyAB9vmqN3uQ7FjRGTy", "spotify", "album", "4aawyAB9vmqN3uQ7FjRGTy"],
    ["spotify:playlist:37i9dQZF1DXcBWIGoYBM5M", "spotify", "playlist", "37i9dQZF1DXcBWIGoYBM5M"],
    ["https://music.apple.com/fr/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb", "apple", "playlist", "pl.f4d106fed2bd41149aaacabb233eb5eb"],
    ["https://music.apple.com/us/album/housewife/6822497770", "apple", "album", "6822497770"],
    ["https://www.deezer.com/fr/playlist/1109890291", "deezer", "playlist", "1109890291"],
    ["https://deezer.com/album/302127", "deezer", "album", "302127"],
    ["https://link.deezer.com/s/31abcDEF", "deezer", "short", "31abcDEF"],
    ["https://spotify.link/AbCdEf123", "spotify", "short", "AbCdEf123"],
    ["https://music.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG", "youtube", "playlist", "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG"],
    ["https://www.youtube.com/watch?v=abc&list=OLAK5uy_kdpYi8fFeMV1Mm9gHgvf3BU1x5Q", "youtube", "playlist", "OLAK5uy_kdpYi8fFeMV1Mm9gHgvf3BU1x5Q"],
  ])("%s", (input, source, kind, id) => {
    expect(recognizeImportUrl(input)).toMatchObject({ source, kind, id });
  });

  it("donne un lien canonique sur un hôte de la liste", () => {
    expect(recognizeImportUrl("http://www.deezer.com/en/playlist/42?utm=x")?.url).toBe("https://www.deezer.com/playlist/42");
    expect(recognizeImportUrl("https://music.apple.com/fr/playlist/x/pl.u-abcdefgh12")?.url).toBe("https://music.apple.com/fr/playlist/x/pl.u-abcdefgh12");
  });

  it.each([
    "https://evil.example/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "https://open.spotify.com.evil.example/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M",
    "https://open.spotify.com/playlist/../../x",
    "https://music.apple.com/fr/playlist/x/6822497770",
    "https://www.deezer.com/playlist/abc",
    "file:///etc/passwd",
    "ftp://www.deezer.com/playlist/1",
    "https://127.0.0.1/playlist/1",
    "pas un lien",
    `https://open.spotify.com/playlist/${"a".repeat(3000)}`,
  ])("refuse %s", (input) => {
    expect(recognizeImportUrl(input)).toBeNull();
  });
});

describe("absentPositions — la place d'un absent, sémantique de playlistAdd", () => {
  it("compte les présents qui le précèdent", () => {
    // Source : A(présent) B(absent) C(présent) D(absent) E(absent)
    expect([...absentPositions(5, new Set([0, 2]))]).toEqual([
      [1, 1],
      [3, 2],
      [4, 2],
    ]);
  });

  it("tout absent : tous en tête, dans l'ordre", () => {
    expect([...absentPositions(3, new Set())]).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
  });
});

describe("manifeste : points d'import optionnels", () => {
  it("lit importRead, importTracks et la liste fermée des sources", () => {
    const m = readPluginMusicManifest({ search: "/s", resolve: "/r", importRead: "/import/read", importTracks: "/import/tracks", importSources: ["youtube", "text", "myspace"] });
    expect(m).toMatchObject({ importRead: "/import/read", importTracks: "/import/tracks", importSources: ["youtube"] });
  });

  it("absents : la fonction n'existe pas, sans erreur", () => {
    const m = readPluginMusicManifest({ search: "/s", resolve: "/r" });
    expect(m?.importTracks).toBeUndefined();
    expect(m?.importSources).toBeUndefined();
  });

  it("lots (1.43.0) : `importBatches` seulement avec `importTracks`", () => {
    expect(readPluginMusicManifest({ search: "/s", resolve: "/r", importTracks: "/t", importBatches: true })?.importBatches).toBe(true);
    expect(readPluginMusicManifest({ search: "/s", resolve: "/r", importBatches: true })?.importBatches).toBeUndefined();
    expect(readPluginMusicManifest({ search: "/s", resolve: "/r", importTracks: "/t", importBatches: "oui" })?.importBatches).toBeUndefined();
  });

  it("lecture d'abord (1.43.0) : `importReadFirst` ⊂ `importSources`, jamais YouTube (toujours l'extension)", () => {
    const m = readPluginMusicManifest({ search: "/s", resolve: "/r", importRead: "/i", importSources: ["spotify", "youtube"], importReadFirst: ["spotify", "apple", "youtube"] });
    expect(m?.importReadFirst).toEqual(["spotify"]);
    expect(readPluginMusicManifest({ search: "/s", resolve: "/r", importReadFirst: ["spotify"] })?.importReadFirst).toBeUndefined();
  });
});

describe("importBatchesOf — les absents découpés en lots", () => {
  it("9 001 titres : 19 lots, le dernier d'un titre, `index` gardés", () => {
    const tracks = Array.from({ length: 9_001 }, (_, index) => ({ index }));
    const batches = importBatchesOf(tracks);
    expect(batches).toHaveLength(19);
    expect(batches[0]).toHaveLength(MUSIC_IMPORT_BATCH.size);
    expect(batches[18]).toEqual([{ index: 9_000 }]);
    expect(batches.flat().map((t) => t.index)).toEqual(tracks.map((t) => t.index));
  });

  it("rien à confier : aucun lot ; une taille absurde vaut 1", () => {
    expect(importBatchesOf([])).toEqual([]);
    expect(importBatchesOf([1, 2], 0)).toEqual([[1], [2]]);
  });
});
