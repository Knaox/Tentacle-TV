import { describe, expect, it } from "vitest";
import { barsMotion, shownBeneathPlayer } from "./onScreen";

describe("une surface sous le lecteur plein écran se voit-elle ?", () => {
  it("oui seulement app active, page regardée, lecteur fermé", () => {
    expect(shownBeneathPlayer({ appActive: true, pageFocused: true, playerOpen: false })).toBe(true);
  });

  it("non app derrière, page restée dans la pile, ou lecteur plein écran ouvert", () => {
    expect(shownBeneathPlayer({ appActive: false, pageFocused: true, playerOpen: false })).toBe(false);
    expect(shownBeneathPlayer({ appActive: true, pageFocused: false, playerOpen: false })).toBe(false);
    expect(shownBeneathPlayer({ appActive: true, pageFocused: true, playerOpen: true })).toBe(false);
  });
});

describe("les barres du titre en cours", () => {
  it("dansent en lecture quand on les voit", () => {
    expect(barsMotion({ shown: true, playing: true, reducedMotion: false })).toBe("dance");
  });

  it("se posent en douceur en pause, sous les yeux", () => {
    expect(barsMotion({ shown: true, playing: false, reducedMotion: false })).toBe("rest");
  });

  it("ne s'animent pas du tout quand personne ne les voit, même en lecture", () => {
    expect(barsMotion({ shown: false, playing: true, reducedMotion: false })).toBe("still");
    expect(barsMotion({ shown: false, playing: false, reducedMotion: false })).toBe("still");
  });

  it("restent immobiles avec le mouvement réduit", () => {
    expect(barsMotion({ shown: true, playing: true, reducedMotion: true })).toBe("still");
  });
});
