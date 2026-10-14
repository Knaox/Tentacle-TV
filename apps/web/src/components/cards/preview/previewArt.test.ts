import { describe, expect, it } from "vitest";
import type { MediaItem } from "@tentacle-tv/shared";
import { previewArtOf, previewBackdropOf, previewNeedsDetail, previewStillUrlOf } from "./previewArt";

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

describe("previewNeedsDetail / previewArtOf — la fiche quand la carte se tait", () => {
  const row = item({ Id: "c", BackdropImageTags: ["bd"] });
  const withLogo = item({ Id: "c", BackdropImageTags: ["bd"], ImageTags: { Logo: "lg" } });

  it("lit la fiche quand la carte n'annonce pas de logo (rangées, grilles)", () => {
    expect(previewNeedsDetail(row, false)).toBe(true);
    expect(previewNeedsDetail(withLogo, true)).toBe(false);
  });

  it("lit la fiche quand il faut un fond que la carte n'annonce pas", () => {
    const logoOnly = item({ Id: "c", ImageTags: { Logo: "lg" } });
    expect(previewNeedsDetail(logoOnly, true)).toBe(true);
    expect(previewNeedsDetail(logoOnly, false)).toBe(false);
  });

  it("lit la fiche sans item de carte (une recommandation)", () => {
    expect(previewNeedsDetail(null, false)).toBe(true);
  });

  it("préfère ce que la carte annonce, puis ce que la fiche annonce", () => {
    const detail = item({ Id: "c", ImageTags: { Logo: "lg2" }, BackdropImageTags: ["bd2"] });
    expect(previewArtOf(row, detail)).toEqual({ logo: { id: "c", tag: "lg2" }, backdrop: { id: "c", tag: "bd" } });
    expect(previewArtOf(withLogo, detail).logo).toEqual({ id: "c", tag: "lg" });
    expect(previewArtOf(row, null)).toEqual({ logo: null, backdrop: { id: "c", tag: "bd" } });
  });
});

describe("previewStillUrlOf — l'image du titre, sans fiche", () => {
  const url = (id: string, type: string, options: { width: number; tag: string }) => `/img/${id}/${type}?w=${options.width}&tag=${options.tag}`;

  it("l'image que la carte donne d'abord, puis le fond qu'elle annonce, puis celui de la fiche", () => {
    expect(previewStillUrlOf(url, item({ Id: "m", BackdropImageTags: ["t"] }), "https://x/still.jpg")).toBe("https://x/still.jpg");
    expect(previewStillUrlOf(url, item({ Id: "m", BackdropImageTags: ["t"] }), null)).toBe("/img/m/Backdrop?w=780&tag=t");
    expect(previewStillUrlOf(url, item({ Id: "m" }), null, item({ Id: "m", BackdropImageTags: ["d"] }))).toBe("/img/m/Backdrop?w=780&tag=d");
  });

  it("rien quand rien n'est annoncé : jamais une image demandée à l'aveugle", () => {
    expect(previewStillUrlOf(url, item({ Id: "m" }), null)).toBeNull();
    expect(previewStillUrlOf(url, null, null)).toBeNull();
  });
});
