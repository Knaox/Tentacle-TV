import { describe, expect, it } from "vitest";
import { recognizeReleaseUrl, releaseArtSized } from "./musicReleases";
import { readPluginMusicManifest } from "./pluginMusicContract";

describe("sorties importées — le contrat", () => {
  it("le manifeste garde `releases` et la liste fermée `releaseSources`", () => {
    const m = readPluginMusicManifest({ search: "/s", resolve: "/r", releases: "/music/releases", releaseSources: ["files", "spotify", "bandcamp"] });
    expect(m?.releases).toBe("/music/releases");
    expect(m?.releaseSources).toEqual(["bandcamp", "files"]);
  });

  it("une extension d'avant : ni `releases` ni sources", () => {
    const m = readPluginMusicManifest({ search: "/s", resolve: "/r", releases: "../x", releaseSources: ["youtube"] });
    expect(m?.releases).toBeUndefined();
    expect(m?.releaseSources).toBeUndefined();
  });

  it("reconnaît un lien Bandcamp dans un texte partagé", () => {
    expect(recognizeReleaseUrl("Écoute ça https://bastienbecker.bandcamp.com/album/edition-speciale?from=fanpub_fnb !")).toEqual({
      source: "bandcamp",
      kind: "album",
      url: "https://bastienbecker.bandcamp.com/album/edition-speciale",
    });
    expect(recognizeReleaseUrl("https://x.bandcamp.com/track/un-titre/")?.kind).toBe("track");
    expect(recognizeReleaseUrl("https://x.bandcamp.com/music")).toBeNull();
    expect(recognizeReleaseUrl("https://evil.com/x.bandcamp.com/album/y")).toBeNull();
  });

  it("change la taille d'une pochette importée, et seulement elle", () => {
    expect(releaseArtSized("/api/plugins/sillon/music/releases/art/abc123/700", "300")).toBe("/api/plugins/sillon/music/releases/art/abc123/300");
    expect(releaseArtSized("/api/plugins/sillon/music/art/rg/x/250", "300")).toBe("/api/plugins/sillon/music/art/rg/x/250");
  });
});
