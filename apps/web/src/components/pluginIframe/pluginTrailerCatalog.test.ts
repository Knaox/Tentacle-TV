import { describe, expect, it, vi } from "vitest";

/**
 * Le lecteur complet ouvert par une extension (`openTrailerFor`) : la demande
 * validée, le catalogue du serveur lu en file pour le lecteur, la lecture qui
 * part de la bande-annonce cliquée — et le pont qui l'expose.
 */

const fetchMock = vi.hoisted(() => vi.fn<(path: string) => Promise<unknown>>());
vi.mock("@tentacle-tv/api-client", () => ({ tentacleApiFetch: (path: string) => fetchMock(path) }));

import {
  buildTrailerCatalogBridgeMethod, loadPluginTrailerQueue, parsePluginTrailerCatalogQuery,
} from "./pluginTrailerCatalog";

const entry = (playback: unknown, name: string) => ({
  scope: { kind: "season", season: 6 }, playback, name, version: "localized", type: "trailer", source: "allocine",
});

describe("lecteur complet ouvert par une extension", () => {
  it("valide la demande : un titre TMDB, une saison seulement pour une série", () => {
    expect(parsePluginTrailerCatalogQuery({ tmdbId: 60625, mediaType: "tv", season: 6, start: "dm:x8e90ff" }))
      .toEqual({ tmdbId: 60625, mediaType: "tv", season: 6, start: "dm:x8e90ff" });
    expect(parsePluginTrailerCatalogQuery({ tmdbId: 603, mediaType: "movie", season: 2 })).toEqual({ tmdbId: 603, mediaType: "movie" });
    expect(parsePluginTrailerCatalogQuery({ tmdbId: -1, mediaType: "movie" })).toBeNull();
    expect(parsePluginTrailerCatalogQuery({ tmdbId: 603, mediaType: "book" })).toBeNull();
    expect(parsePluginTrailerCatalogQuery({ tmdbId: 603, mediaType: "movie", start: "javascript:x" })?.start).toBeUndefined();
  });

  it("lit le catalogue en file, sans les bandes-annonces locales, et part de la cliquée", async () => {
    fetchMock.mockResolvedValue({
      complete: true, language: "fr-FR",
      entries: [entry({ kind: "jellyfin", itemId: "a".repeat(32) }, "locale"), entry({ kind: "dailymotion", videoId: "x8e90ff" }, "VF"), entry({ kind: "youtube", ytId: "Way9Dexny3w" }, "VO")],
    });
    const loaded = await loadPluginTrailerQueue({ tmdbId: 60625, mediaType: "tv", season: 6, start: "yt:Way9Dexny3w" }, "fr");
    expect(fetchMock).toHaveBeenCalledWith("/api/trailers/catalog?tmdbId=60625&mediaType=tv&season=6&lang=fr");
    expect(loaded?.queue.map((q) => q.name)).toEqual(["VF", "VO"]);
    expect(loaded?.start).toBe(1);
    expect(loaded?.language).toBe("fr-FR");
  });

  it("rien à lire, ou serveur muet : rien ne s'ouvre", async () => {
    fetchMock.mockResolvedValue({ complete: true, language: "fr", entries: [] });
    expect(await loadPluginTrailerQueue({ tmdbId: 603, mediaType: "movie" }, "fr")).toBeNull();
    fetchMock.mockRejectedValue(new Error("404"));
    expect(await loadPluginTrailerQueue({ tmdbId: 603, mediaType: "movie" }, "fr")).toBeNull();
  });

  it("le pont expose openTrailerFor, qui poste le message à l'hôte", () => {
    const posted: unknown[] = [];
    const parent = { postMessage: (message: unknown) => posted.push(message) };
    const bridge = new Function("parent", `return {${buildTrailerCatalogBridgeMethod()}};`)(parent) as { openTrailerFor: (q: unknown) => void };
    bridge.openTrailerFor({ tmdbId: 603, mediaType: "movie", title: "Matrix" });
    expect(posted).toEqual([{ type: "OPEN_TRAILER_CATALOG", tmdbId: 603, mediaType: "movie", season: undefined, title: "Matrix", start: undefined }]);
  });
});
