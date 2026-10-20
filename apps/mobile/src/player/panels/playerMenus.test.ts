import { describe, expect, it } from "vitest";
import { menuTitleKey, playerMenuSections, playerMenusAvailable, showSectionTitles } from "./playerMenus";

describe("menus du lecteur", () => {
  it("Audio et sous-titres : l'audio d'abord, puis les sous-titres", () => {
    expect(playerMenuSections("tracks", { audio: 2, subtitles: 3, quality: 5 })).toEqual(["audio", "subtitles"]);
  });

  it("Réglages : la qualité seule (l'audio a rejoint les sous-titres)", () => {
    expect(playerMenuSections("settings", { audio: 2, subtitles: 3, quality: 5 })).toEqual(["quality"]);
  });

  it("une section vide n'est pas rendue", () => {
    expect(playerMenuSections("tracks", { audio: 1, subtitles: 0, quality: 0 })).toEqual(["audio"]);
  });

  it("lecture locale (aucun palier) : pas de roue, les pistes restent", () => {
    expect(playerMenusAvailable({ audio: 1, subtitles: 2, quality: 0 })).toEqual({ tracks: true, settings: false });
  });

  it("aucune piste connue : pas de bouton des sous-titres", () => {
    expect(playerMenusAvailable({ audio: 0, subtitles: 0, quality: 4 })).toEqual({ tracks: false, settings: true });
  });

  it("les titres de section ne paraissent qu'à partir de deux sections", () => {
    expect(showSectionTitles(["audio", "subtitles"])).toBe(true);
    expect(showSectionTitles(["quality"])).toBe(false);
  });

  it("un menu à une section prend son nom", () => {
    expect(menuTitleKey("settings", ["quality"])).toBe("panels.quality");
    expect(menuTitleKey("tracks", ["subtitles"])).toBe("panels.subtitles");
    expect(menuTitleKey("tracks", ["audio", "subtitles"])).toBe("panels.tracksTitle");
  });
});
