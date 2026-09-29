import { describe, expect, it } from "vitest";
import { mediaVersions, pickMediaSource } from "./mediaVersions";

const src = (Id: string, Name?: string, Height?: number) => ({
  Id, Name: Name as string, MediaStreams: Height ? [{ Type: "Video", Index: 0, Height } as never] : [],
});

describe("mediaVersions", () => {
  it("rien à choisir : une source ou aucune", () => {
    expect(mediaVersions(undefined)).toEqual([]);
    expect(mediaVersions([src("a", "1080p")])).toEqual([]);
  });

  it("les noms de Jellyfin, dans un ordre stable : définition décroissante", () => {
    const expected = [{ id: "a", label: "1080p" }, { id: "b", label: "720p" }];
    expect(mediaVersions([src("a", "1080p"), src("b", "720p")])).toEqual(expected);
    // Jellyfin met en tête la dernière version lue : l'ordre affiché, lui, ne bouge pas.
    expect(mediaVersions([src("b", "720p"), src("a", "1080p")])).toEqual(expected);
    expect(mediaVersions([src("b", "Version courte", 720), src("a", "Director's Cut", 1080)]).map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("même définition : par nom", () => {
    expect(mediaVersions([src("t", "Théâtrale", 1080), src("d", "Director's Cut", 1080)]).map((v) => v.label)).toEqual(["Director's Cut", "Théâtrale"]);
  });

  it("sans nom, la définition ; sans définition, un rang", () => {
    expect(mediaVersions([src("a", "", 2160), src("b", undefined)]).map((v) => v.label)).toEqual(["2160p", "Version 2"]);
  });
});

describe("pickMediaSource", () => {
  const sources = [src("a"), src("b")];
  it("la version demandée si le titre l'a, sinon la première", () => {
    expect(pickMediaSource(sources, "b")?.Id).toBe("b");
    expect(pickMediaSource(sources, "inconnue")?.Id).toBe("a");
    expect(pickMediaSource(sources, null)?.Id).toBe("a");
    expect(pickMediaSource([], "b")).toBeUndefined();
  });
});
