/**
 * Les liens partagés d'Octave, côté serveur : la lecture d'un lien Shazam (adresse REBÂTIE, hôtes fermés,
 * lien court suivi à la main, en-tête seulement) et la page d'ouverture (liste fermée de pages, sans script).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogTrackOf, resetShazamCache, resolveShazamLink, type ShazamFetch } from "./shazamResolve";
import { octaveOpenPageHtml, openPageTarget } from "./openPage";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const shazamBody = (title: string, subtitle: string) => json({ type: "MUSIC", key: "1", title, subtitle });
const itunesBody = (trackName: string, artistName: string) => json({ resultCount: 1, results: [{ wrapperType: "track", kind: "song", trackName, artistName }] });

describe("lien Shazam lu par le serveur", () => {
  beforeEach(() => resetShazamCache());

  it("`/track/<clé>` : le catalogue de Shazam, adresse rebâtie depuis la clé", async () => {
    const fetcher = vi.fn<ShazamFetch>(async () => shazamBody("Kiss the Rain", "Billie Myers"));
    const result = await resolveShazamLink("https://www.shazam.com/fr-fr/track/20066955/kiss-the-rain?referrer=share", fetcher);
    expect(result).toEqual({ source: "shazam", title: "Kiss the Rain", artist: "Billie Myers", query: "Kiss the Rain Billie Myers" });
    expect(fetcher.mock.calls[0]![0]).toBe("https://cdn.shazam.com/discovery/v5/en-US/US/web/-/track/20066955");
    expect(fetcher.mock.calls[0]![1].redirect).toBe("manual");
    // Gardé : la seconde demande ne repart pas.
    await resolveShazamLink("https://www.shazam.com/track/20066955/x", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("`/song/<id>` : l'identifiant Apple Music, la recherche iTunes", async () => {
    const fetcher = vi.fn<ShazamFetch>(async () => itunesBody("the feeling", "Steve Lacy"));
    expect(await resolveShazamLink("https://www.shazam.com/song/6773775295/the-feeling", fetcher)).toMatchObject({ title: "the feeling", artist: "Steve Lacy" });
    expect(fetcher.mock.calls[0]![0]).toBe("https://itunes.apple.com/lookup?id=6773775295&entity=song");
  });

  it("un lien court se suit, une redirection reconnue à la fois", async () => {
    const fetcher = vi.fn<ShazamFetch>(async (url) =>
      url.startsWith("https://shz.am/") ? new Response(null, { status: 301, headers: { location: "https://www.shazam.com/track/7/x" } }) : shazamBody("A", "B"),
    );
    expect(await resolveShazamLink("https://shz.am/t7", fetcher)).toMatchObject({ title: "A", artist: "B" });
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(["https://shz.am/t7", "https://cdn.shazam.com/discovery/v5/en-US/US/web/-/track/7"]);
  });

  it("une redirection vers un tiers n'est jamais suivie", async () => {
    const fetcher = vi.fn<ShazamFetch>(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }));
    expect(await resolveShazamLink("https://shz.am/abc", fetcher)).toEqual({ refusal: "not_found" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("un autre hôte n'est jamais demandé", async () => {
    const fetcher = vi.fn<ShazamFetch>();
    expect(await resolveShazamLink("http://localhost:3001/track/1/x", fetcher)).toEqual({ refusal: "unsupported" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("catalogue muet ou en panne : refus en liste fermée", async () => {
    expect(await resolveShazamLink("https://www.shazam.com/track/1/x", async () => new Response("", { status: 404 }))).toEqual({ refusal: "not_found" });
    expect(await resolveShazamLink("https://www.shazam.com/track/2/x", async () => new Response("", { status: 503 }))).toEqual({ refusal: "unavailable" });
    expect(await resolveShazamLink("https://www.shazam.com/track/3/x", async () => { throw new Error("réseau"); })).toEqual({ refusal: "unavailable" });
    expect(await resolveShazamLink("https://www.shazam.com/song/4/x", async () => json({ resultCount: 0, results: [] }))).toEqual({ refusal: "not_found" });
    expect(await resolveShazamLink("https://www.shazam.com/track/5/x", async () => new Response("<html>", { status: 200 }))).toEqual({ refusal: "unavailable" });
  });

  it("forme du catalogue : sans titre → null, l'artiste facultatif", () => {
    expect(catalogTrackOf("shazam", { title: "Seul" })).toMatchObject({ title: "Seul", artist: null, query: "Seul" });
    expect(catalogTrackOf("apple", { results: [{ kind: "album", trackName: "x" }] })).toBeNull();
    expect(catalogTrackOf("shazam", null)).toBeNull();
  });
});

describe("page d'ouverture d'un lien", () => {
  it.each([
    ["/playlist/abc", undefined, "/octave/playlist/abc"],
    ["/album/ext%3Asillon%3A1/", undefined, "/octave/album/ext%3Asillon%3A1"],
    ["/search", "Blinding Lights", "/octave/search?q=Blinding%20Lights"],
  ])("%s ouvre %s", (rest, q, route) => expect(openPageTarget(rest, q)?.route).toBe(route));

  it.each(["/settings", "/import", "/search", "/playlist/a/b", "/playlist/"])("%s n'est pas une page admise", (rest) => expect(openPageTarget(rest, undefined)).toBeNull());

  it("aucun script, le schéma de l'app, le navigateur seulement si le web est ouvert", () => {
    const base = { lang: "fr" as const, kind: "playlist" as const, route: "/octave/playlist/abc", path: "/octave/open/playlist/abc", prefix: "", nonce: "n" };
    const open = octaveOpenPageHtml({ ...base, webUi: true });
    expect(open).not.toMatch(/<script/i);
    expect(open).toContain('href="tentacle://octave/playlist/abc"');
    expect(open).toContain('href="/octave/playlist/abc"');
    expect(open).toContain("Une playlist pour vous");
    expect(octaveOpenPageHtml({ ...base, webUi: false })).not.toContain('href="/octave/playlist/abc"');
  });
});
