import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Linking: { openURL: vi.fn() } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: vi.fn() } }));

const { createBridgeHandler, trailerCatalogHref } = await import("./pluginBridge");
const { buildHostBridgeScript } = await import("./pluginHostBridgeScript");

describe("le pont des extensions › openTrailerFor", () => {
  it("un titre TMDB (et sa saison) ouvre l'écran des bandes-annonces, à partir de la vidéo touchée", () => {
    expect(trailerCatalogHref({ tmdbId: 60625, mediaType: "tv", season: 7, start: "dm:x8e90ff" }))
      .toBe("/trailer?tmdbId=60625&mediaType=tv&season=7&start=dm%3Ax8e90ff");
    expect(trailerCatalogHref({ tmdbId: "329865", mediaType: "movie" })).toBe("/trailer?tmdbId=329865&mediaType=movie");
  });

  it("un message invalide est ignoré", () => {
    expect(trailerCatalogHref({ tmdbId: -1, mediaType: "tv" })).toBeNull();
    expect(trailerCatalogHref({ tmdbId: 1, mediaType: "person" })).toBeNull();
    expect(trailerCatalogHref({ tmdbId: { x: 1 }, mediaType: "movie" })).toBeNull();
  });

  it("le natif pousse la route ; le son des aperçus n'a pas d'effet", () => {
    const push = vi.fn();
    const handle = createBridgeHandler({ push } as never);
    handle({ nativeEvent: { data: JSON.stringify({ type: "OPEN_TRAILER_CATALOG", tmdbId: 1396, mediaType: "tv" }) } });
    handle({ nativeEvent: { data: JSON.stringify({ type: "OPEN_TRAILER_CATALOG", tmdbId: "x", mediaType: "tv" }) } });
    handle({ nativeEvent: { data: JSON.stringify({ type: "TRAILER_PREVIEW_MUTED", muted: true }) } });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/trailer?tmdbId=1396&mediaType=tv");
  });

  it("la page trouve openTrailerFor et setTrailerPreviewMuted sur le pont, avec les champs de l'hôte web", () => {
    const posted: string[] = [];
    const page = { ReactNativeWebView: { postMessage: (m: string) => posted.push(m) } } as Record<string, unknown>;
    new Function("window", "document", "KeyboardEvent", buildHostBridgeScript())(page, {}, class {});
    const bridge = page.__tentacle_bridge as { openTrailerFor: (q: unknown) => void; setTrailerPreviewMuted: (m: unknown) => void };
    bridge.openTrailerFor({ tmdbId: 60625, mediaType: "tv", season: 7, title: "Rick et Morty", start: "yt:WNhH00OIPP0" });
    bridge.setTrailerPreviewMuted(true);
    expect(posted.map((m) => JSON.parse(m))).toEqual([
      { type: "OPEN_TRAILER_CATALOG", tmdbId: 60625, mediaType: "tv", season: 7, title: "Rick et Morty", start: "yt:WNhH00OIPP0" },
      { type: "TRAILER_PREVIEW_MUTED", muted: true },
    ]);
  });
});
