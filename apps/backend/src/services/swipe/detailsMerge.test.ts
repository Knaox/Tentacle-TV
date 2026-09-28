import { describe, expect, it } from "vitest";
import { cleanOverview, mergeDetails } from "./detailsMerge";

describe("verso d'une carte", () => {
  it("le HTML des fiches AniDB part, les sauts de ligne restent", () => {
    expect(cleanOverview("Asta veut devenir roi.<br>Source: Viz Media via <a href=\"x\">ANN</a><br/>Note : 2016")).toBe(
      "Asta veut devenir roi.\nSource: Viz Media via ANN\nNote : 2016"
    );
    expect(cleanOverview("Tom &amp; Jerry &#39;s&apos;amusent&quot;")).toBe("Tom & Jerry 's'amusent\"");
    expect(cleanOverview("  <p> </p> ")).toBeNull();
    expect(cleanOverview(undefined)).toBeNull();
  });

  const remote = { title: "Le Titre FR", overview: "Synopsis français", runtimeMinutes: 120, seasons: null };
  const local = { title: "Library Title", overview: "English synopsis<br>more", runtimeMinutes: 118, seasons: null };

  it("TMDB (langue de l'interface) d'abord, Jellyfin en repli", () => {
    expect(mergeDetails(remote, local, true).overview).toBe("Synopsis français");
    expect(mergeDetails({ ...remote, overview: "" }, local, true).overview).toBe("English synopsis\nmore");
    expect(mergeDetails(null, local, true)).toEqual({ title: null, overview: "English synopsis\nmore", runtimeMinutes: 118, seasons: null });
  });

  it("un titre de bibliothèque garde son titre ; hors bibliothèque, le titre TMDB localisé", () => {
    expect(mergeDetails(remote, local, true).title).toBeNull();
    expect(mergeDetails(remote, null, false).title).toBe("Le Titre FR");
  });
});
