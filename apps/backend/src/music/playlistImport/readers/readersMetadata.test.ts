/**
 * Lot « pg » (10/11) : ce que chaque source dit d'un titre arrive jusqu'au bout — pochette, contenu explicite —,
 * sur les pages RÉELLES relevées le 10/11/2026 (`__fixtures__/*-10k.html`, `*-50.html`, réduites, SANS jeton), et
 * une playlist lue par une extension garde ces champs en repassant par le cœur. Aucun réseau.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { ImportFetcher } from "../importFetch";
import { sanitizePlaylist } from "../importInput";
import { readApple } from "./appleReader";
import { readSpotify } from "./spotifyReader";
import { readText } from "./textReader";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");
const page = (name: string): ImportFetcher => async (url) => ({ status: 200, url, body: fixture(name) });

describe("Spotify — « 2010s: 10,000 Songs », page d'intégration", () => {
  it("100 titres sur 10 000 : tronquée, le contenu explicite dit, la couverture sur spotifycdn acceptée", async () => {
    const pl = await readSpotify(page("spotify-playlist-10k.html"), "playlist", "69VOdzkx8II6pi0sUvcu65");
    expect(pl.tracks).toHaveLength(100);
    expect(pl.truncated).toBe(true);
    expect(pl.name).toBe("2010s: 10,000 Songs");
    expect(pl.artworkUrl).toMatch(/^https:\/\/image-cdn-ak\.spotifycdn\.com\//);
    expect(pl.tracks.filter((t) => t.explicit).length).toBe(7);
    expect(pl.tracks[0]).toMatchObject({ title: "Dancing On My Own - Radio Edit", artists: ["Robyn"], durationMs: 278_080 });
    // La page ne dit ni l'album ni la pochette d'un titre : rien d'inventé.
    expect(pl.tracks.every((t) => t.album === null && !t.artworkUrl)).toBe(true);
  });
});

describe("Apple Music — « Today's Hits », page publique", () => {
  it("chaque titre a sa pochette (300 px, hôte d'Apple) et son badge explicite", async () => {
    const pl = await readApple(page("apple-playlist-50.html"), "playlist", "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb");
    expect(pl.tracks).toHaveLength(50);
    expect(pl.truncated).toBe(false);
    expect(pl.tracks.every((t) => /^https:\/\/is\d+-ssl\.mzstatic\.com\/.*\/300x300bb\.jpg$/.test(t.artworkUrl ?? ""))).toBe(true);
    expect(pl.tracks.filter((t) => t.explicit).length).toBe(17);
    expect(pl.tracks[0]?.album).toBe("Choosin' Texas");
    expect(pl.artworkUrl).toMatch(/600x600bb\.jpg$/);
  });
});

describe("une playlist lue par une extension (`importRead`) repasse par le cœur sans rien perdre", () => {
  it("pochette https gardée, http ou bizarre jetée ; explicite et motif de la source gardés", () => {
    const pl = sanitizePlaylist({
      source: "spotify",
      name: "Géante",
      truncated: false,
      artworkUrl: "https://i.scdn.co/image/abc",
      tracks: [
        { index: 0, title: "A", artists: ["X"], album: "Al", durationMs: 200_000, isrc: "usum71703861", sourceId: "s:0", artworkUrl: "https://i.scdn.co/image/a", explicit: true },
        { index: 1, title: "B", artists: ["Y"], album: null, durationMs: null, isrc: null, sourceId: null, artworkUrl: "http://evil.example/b", sourceBlocked: "region" },
        { index: 2, title: "C", artists: ["Z"], album: null, durationMs: null, isrc: null, sourceId: null, artworkUrl: "javascript:alert(1)" },
      ],
    });
    expect(pl.tracks[0]).toMatchObject({ artworkUrl: "https://i.scdn.co/image/a", explicit: true, isrc: "USUM71703861", album: "Al" });
    expect(pl.tracks[1]).toMatchObject({ artworkUrl: null, sourceBlocked: "region" });
    expect(pl.tracks[1]?.explicit).toBeUndefined();
    expect(pl.tracks[2]?.artworkUrl).toBeNull();
    expect(pl.artworkUrl).toBe("https://i.scdn.co/image/abc");
  });

  it("9 000 titres d'une extension : tous gardés, numérotés dans l'ordre", () => {
    const tracks = Array.from({ length: 9_000 }, (_, i) => ({ index: i, title: `T${i}`, artists: ["A"], album: null, durationMs: null, isrc: null, sourceId: null }));
    const pl = sanitizePlaylist({ source: "youtube", name: "Y", truncated: false, artworkUrl: null, tracks });
    expect(pl.tracks).toHaveLength(9_000);
    expect(pl.truncated).toBe(false);
    expect(pl.tracks[8_999]?.index).toBe(8_999);
  });
});

describe("un export CSV (Exportify) : pochette, explicite, identifiant", () => {
  it("lit « Album Image URL », « Explicit » et « Track URI »", () => {
    const csv = [
      "Track URI,Track Name,Artist Name(s),Album Name,Album Image URL,Track Duration (ms),Explicit,ISRC",
      "spotify:track:1,Hello,Adele,25,https://i.scdn.co/image/h,295000,false,GBBKS1500214",
      "spotify:track:2,HUMBLE.,Kendrick Lamar,DAMN.,https://i.scdn.co/image/d,177000,true,USUM71703861",
    ].join("\n");
    const pl = readText(csv);
    expect(pl.tracks[0]).toMatchObject({ sourceId: "spotify:track:1", artworkUrl: "https://i.scdn.co/image/h", album: "25" });
    expect(pl.tracks[0]?.explicit).toBeUndefined();
    expect(pl.tracks[1]).toMatchObject({ explicit: true, isrc: "USUM71703861", durationMs: 177_000 });
  });
});
