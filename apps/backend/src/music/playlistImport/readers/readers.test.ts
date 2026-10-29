/**
 * Les lecteurs de sources, sur les réponses RÉELLES enregistrées le 26/10/2026
 * (`__fixtures__`, réduites, sans jeton) : aucun réseau.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { FetchedPage, ImportFetcher } from "../importFetch";
import { readApple } from "./appleReader";
import { readDeezer } from "./deezerReader";
import { ImportReadFailure } from "./readerKit";
import { readSpotify } from "./spotifyReader";

const fixture = (name: string) => readFileSync(join(__dirname, "..", "__fixtures__", name), "utf8");

/** Une source factice : chaque adresse demandée → une fixture (ou un statut). */
function fake(routes: Record<string, string | number>, seen: string[] = []): ImportFetcher {
  return async (url): Promise<FetchedPage> => {
    seen.push(url);
    const hit = routes[url];
    if (hit === undefined) throw new Error(`adresse inattendue : ${url}`);
    return typeof hit === "number" ? { status: hit, url, body: "" } : { status: 200, url, body: fixture(hit) };
  };
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "aucune";
  } catch (error) {
    return error instanceof ImportReadFailure ? error.failure : String(error);
  }
}

describe("Spotify (page d'intégration publique)", () => {
  const PL = "https://open.spotify.com/embed/playlist/37i9dQZF1DX4UtSsGT1Sbe";

  it("lit le nom, les titres, la durée, et découpe les artistes sur la virgule insécable seulement", async () => {
    const pl = await readSpotify(fake({ [PL]: "spotify-playlist.html" }), "playlist", "37i9dQZF1DX4UtSsGT1Sbe");
    expect(pl).toMatchObject({ source: "spotify", name: "All Out 80s", truncated: false });
    expect(pl.artworkUrl).toMatch(/^https:\/\/i\.scdn\.co\//);
    expect(pl.tracks[0]).toMatchObject({ index: 0, album: null, isrc: null });
    expect(pl.tracks[0]?.durationMs).toBeGreaterThan(60_000);
    expect(pl.tracks.find((t) => t.artists.includes("Eurythmics"))?.artists).toEqual(["Eurythmics", "Annie Lennox", "Dave Stewart"]);
    expect(pl.tracks.find((t) => t.artists.some((a) => a.startsWith("Earth")))?.artists).toEqual(["Earth, Wind & Fire"]);
    expect(pl.tracks.map((t) => t.index)).toEqual(pl.tracks.map((_, i) => i));
  });

  it("un album : chaque titre porte le nom de l'album", async () => {
    const url = "https://open.spotify.com/embed/album/4aawyAB9vmqN3uQ7FjRGTy";
    const al = await readSpotify(fake({ [url]: "spotify-album.html" }), "album", "4aawyAB9vmqN3uQ7FjRGTy");
    expect(al.name).toBe("Global Warming");
    expect(al.tracks.every((t) => t.album === "Global Warming")).toBe(true);
    expect(al.tracks[0]?.artists).toEqual(["Pitbull", "Sensato"]);
  });

  it("une playlist inconnue : introuvable", async () => {
    expect(await failure(readSpotify(fake({ [PL]: "spotify-missing.html" }), "playlist", "37i9dQZF1DX4UtSsGT1Sbe"))).toBe("notFound");
    expect(await failure(readSpotify(fake({ [PL]: 503 }), "playlist", "37i9dQZF1DX4UtSsGT1Sbe"))).toBe("unavailable");
  });

  it("100 titres (le plafond de la page) : dit tronquée", async () => {
    const html = fixture("spotify-playlist.html");
    const data = JSON.parse(html.slice(html.indexOf(">", html.indexOf("__NEXT_DATA__")) + 1, html.indexOf("</script>")));
    const entity = data.props.pageProps.state.data.entity;
    entity.trackList = Array.from({ length: 100 }, (_, i) => ({ ...entity.trackList[0], title: `T${i}` }));
    const big: ImportFetcher = async (url) => ({ status: 200, url, body: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>` });
    const pl = await readSpotify(big, "playlist", "x");
    expect(pl.tracks).toHaveLength(100);
    expect(pl.truncated).toBe(true);
  });
});

describe("un titre que la SOURCE ne joue pas (le motif du bilan d'import)", () => {
  it("Spotify `isPlayable: false` : refusé par la source ; un titre jouable ne dit rien", async () => {
    const html = fixture("spotify-playlist.html");
    const data = JSON.parse(html.slice(html.indexOf(">", html.indexOf("__NEXT_DATA__")) + 1, html.indexOf("</script>")));
    data.props.pageProps.state.data.entity.trackList[1].isPlayable = false;
    const page: ImportFetcher = async (url) => ({ status: 200, url, body: `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>` });
    const pl = await readSpotify(page, "playlist", "x");
    expect(pl.tracks[1]?.sourceBlocked).toBe("refused");
    expect(pl.tracks[0]).not.toHaveProperty("sourceBlocked");
  });

  it("Deezer `readable: false` : réservé à d'autres pays", async () => {
    const head = JSON.parse(fixture("deezer-playlist.json"));
    head.tracks.data[2].readable = false;
    const fetcher: ImportFetcher = async (url) => ({ status: 200, url, body: url.includes("index=") ? '{"data":[]}' : JSON.stringify(head) });
    const pl = await readDeezer(fetcher, "playlist", "1109890291");
    expect(pl.tracks[2]?.sourceBlocked).toBe("region");
    expect(pl.tracks[0]).not.toHaveProperty("sourceBlocked");
  });
});

describe("Apple Music (page publique)", () => {
  const URL_PL = "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb";

  it("lit titres, artistes liés, album, et la tronque d'après trackCount", async () => {
    const pl = await readApple(fake({ [URL_PL]: "apple-playlist.html" }), "playlist", URL_PL);
    expect(pl.name).toBe("Today’s Hits");
    expect(pl.tracks[0]).toMatchObject({ title: "Housewife", artists: ["Tate McRae"], album: "Housewife", durationMs: 208_810 });
    expect(pl.tracks.some((t) => t.artists.length >= 2)).toBe(true);
    // La fixture garde 12 des 50 titres : la page en annonce plus qu'elle n'en montre.
    expect(pl.truncated).toBe(true);
    expect(pl.artworkUrl).toMatch(/600x600bb\.jpg$/);
  });

  it("un album : le nom sans « - Single »", async () => {
    const url = "https://music.apple.com/us/album/housewife/6822497770";
    const al = await readApple(fake({ [url]: "apple-album.html" }), "album", url);
    expect(al).toMatchObject({ name: "Housewife", truncated: false });
    expect(al.tracks[0]).toMatchObject({ title: "Housewife", artists: ["Tate McRae"], album: "Housewife" });
  });

  it("404 : introuvable ; page sans données : indisponible", async () => {
    expect(await failure(readApple(fake({ [URL_PL]: 404 }), "playlist", URL_PL))).toBe("notFound");
    const empty: ImportFetcher = async (url) => ({ status: 200, url, body: "<html></html>" });
    expect(await failure(readApple(empty, "playlist", URL_PL))).toBe("unavailable");
  });
});

describe("Deezer (API publique)", () => {
  it("lit la playlist avec l'ISRC de chaque titre", async () => {
    const head = fake({ "https://api.deezer.com/playlist/1109890291": "deezer-playlist.json" });
    // La fixture garde 12 titres sur les 100 annoncés : la suite répond vide ici.
    const fetcher: ImportFetcher = async (url, accept) => (url.includes("index=") ? { status: 200, url, body: '{"data":[]}' } : head(url, accept));
    const pl = await readDeezer(fetcher, "playlist", "1109890291");
    expect(pl.name).toBe("Top France");
    expect(pl.tracks[0]).toMatchObject({ title: "Fille à Papa", artists: ["Vacra"], isrc: "FR9W12641013", durationMs: 169_000 });
    expect(pl.truncated).toBe(true);
  });

  it("demande les pages suivantes quand la playlist en annonce plus", async () => {
    const seen: string[] = [];
    const head = JSON.parse(fixture("deezer-playlist.json"));
    head.nb_tracks = 230;
    head.tracks.data = head.tracks.data.slice(0, 100);
    const page = (at: number) => ({ data: Array.from({ length: Math.min(100, 230 - at) }, (_, i) => ({ ...head.tracks.data[0], id: at + i, title: `T${at + i}` })) });
    const fetcher: ImportFetcher = async (url) => {
      seen.push(url);
      const m = url.match(/index=(\d+)/);
      const body = m ? page(Number(m[1])) : head;
      return { status: 200, url, body: JSON.stringify(body) };
    };
    const pl = await readDeezer(fetcher, "playlist", "1109890291");
    expect(seen.slice(1)).toEqual([
      "https://api.deezer.com/playlist/1109890291/tracks?index=12&limit=100",
      "https://api.deezer.com/playlist/1109890291/tracks?index=112&limit=100",
      "https://api.deezer.com/playlist/1109890291/tracks?index=212&limit=100",
    ]);
    expect(pl.tracks.length).toBeGreaterThan(100);
  });

  it("un album : le nom de l'album, l'artiste de chaque titre", async () => {
    const al = await readDeezer(fake({ "https://api.deezer.com/album/302127": "deezer-album.json" }), "album", "302127");
    expect(al.name).toBe("Discovery");
    expect(al.tracks).toHaveLength(14);
    expect(al.tracks[0]).toMatchObject({ artists: ["Daft Punk"], album: "Discovery" });
  });

  it("l'erreur 800 de l'API : introuvable", async () => {
    expect(await failure(readDeezer(fake({ "https://api.deezer.com/playlist/1": "deezer-missing.json" }), "playlist", "1"))).toBe("notFound");
  });
});
