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

  it("les noms de Jellyfin, dans son ordre (la première est lue par défaut)", () => {
    expect(mediaVersions([src("a", "1080p"), src("b", "720p")])).toEqual([
      { id: "a", label: "1080p" },
      { id: "b", label: "720p" },
    ]);
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
