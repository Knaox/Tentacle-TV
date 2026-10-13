/** L'élision et la contraction du français, après l'interpolation du titre cité. */
import { describe, expect, it } from "vitest";
import { frenchElision, localeText } from "./frenchElision";

describe("frenchElision", () => {
  it("« de » et « que » s'élident devant une voyelle, accentuée comprise", () => {
    expect(frenchElision("Du réalisateur de Iron Man")).toBe("Du réalisateur d'Iron Man");
    expect(frenchElision("Du compositeur de Amadeus")).toBe("Du compositeur d'Amadeus");
    expect(frenchElision("Plus sombre que Alien")).toBe("Plus sombre qu'Alien");
    expect(frenchElision("Venu de Italie")).toBe("Venu d'Italie");
    expect(frenchElision("Du scénariste de Être et avoir")).toBe("Du scénariste d'Être et avoir");
    expect(frenchElision("De Amblin")).toBe("D'Amblin");
  });

  it("le h et le y restent tels quels ; une consonne aussi", () => {
    expect(frenchElision("Musique de Hans Zimmer")).toBe("Musique de Hans Zimmer");
    expect(frenchElision("Du créateur de Yellowstone")).toBe("Du créateur de Yellowstone");
    expect(frenchElision("Du réalisateur de Prisoners")).toBe("Du réalisateur de Prisoners");
    expect(frenchElision("Parce que vous avez aimé Twin Peaks")).toBe("Parce que vous avez aimé Twin Peaks");
  });

  it("« de Le » devient « du », « de Les » devient « des »", () => {
    expect(frenchElision("Du réalisateur de Le Prestige")).toBe("Du réalisateur du Prestige");
    expect(frenchElision("Du scénariste de Les Évadés")).toBe("Du scénariste des Évadés");
    expect(frenchElision("Du réalisateur de La Haine")).toBe("Du réalisateur de La Haine");
    expect(frenchElision("Du réalisateur de L'Armée des ombres")).toBe("Du réalisateur de L'Armée des ombres");
  });

  it("seul le français s'élide", () => {
    expect(localeText("From the director of Iron Man", "en")).toBe("From the director of Iron Man");
    expect(localeText("Du réalisateur de Iron Man", "fr-FR")).toBe("Du réalisateur d'Iron Man");
  });
});
