import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { previewBackdropOf } from "./previewArt";

/** L'image qui grandit avec la mini-carte : le fond du titre, jamais demandé à l'aveugle. */
const item = (over: Partial<MediaItem>) => ({ Id: "x", Name: "x", Type: "Movie", ...over }) as MediaItem;

describe("previewBackdropOf", () => {
  it("prend le fond d'un film ou d'une série", () => {
    expect(previewBackdropOf(item({ Id: "m", BackdropImageTags: ["t1", "t2"] }))).toEqual({ id: "m", tag: "t1" });
    expect(previewBackdropOf(item({ Id: "s", Type: "Series", BackdropImageTags: ["t"] }))).toEqual({ id: "s", tag: "t" });
  });

  it("prend celui de la SÉRIE pour un épisode — c'est sa bande-annonce qui joue", () => {
    const episode = item({ Id: "e", Type: "Episode", SeriesId: "s", ParentBackdropItemId: "s", ParentBackdropImageTags: ["p"] });
    expect(previewBackdropOf(episode)).toEqual({ id: "s", tag: "p" });
  });

  it("ne demande rien sans fond annoncé", () => {
    expect(previewBackdropOf(item({}))).toBeNull();
    expect(previewBackdropOf(item({ Type: "Episode", SeriesId: "s" }))).toBeNull();
  });
});
