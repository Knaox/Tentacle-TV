import { describe, expect, it } from "vitest";
import { namesAnotherTitle } from "./foreignTitleGuard";

const RICK = ["Rick et Morty", "Rick and Morty", "Rick & Morty"];

describe("catalogue › jamais la bande-annonce d'un autre titre", () => {
  it("écarte la vidéo d'un autre titre glissée dans les listes de TMDB (relevé réel : saison 4 de Rick et Morty)", () => {
    expect(namesAnotherTitle("Narcos Mexico: L' Agent Kiki Camarena | Bande-annonce VOSTFR | Netflix", RICK)).toBe(true);
    expect(namesAnotherTitle("Breaking Bad - Season 5 Trailer", RICK)).toBe(true);
  });

  it("garde le titre lui-même, quelle que soit son écriture", () => {
    expect(namesAnotherTitle("Rick and Morty [Saison 4] - Teaser [VF]", RICK)).toBe(false);
    expect(namesAnotherTitle("Rick & Morty [Saison 4] - Bande Annonce [VOST]", RICK)).toBe(false);
    expect(namesAnotherTitle("Rick et Morty - saison 6 Bande-annonce VF", RICK)).toBe(false);
    expect(namesAnotherTitle("RICK AND MORTY | Season 7 Official Trailer | Adult Swim", RICK)).toBe(false);
  });

  it("garde les libellés génériques : rien n'y nomme un autre titre", () => {
    for (const name of [
      "Season 1 Promos", "Official Trailer", "Season 7 Coming to Max Jan 22", "Summer and Beth’s Season 7 Announcement",
      "Official Trailer | Season 4", "Saison 2 - Bande-annonce VF", "Teaser 2 : Nouvelle saison",
    ]) expect(namesAnotherTitle(name, RICK)).toBe(false);
  });

  it("sans nom de titre connu, ou sans libellé : rien n'est écarté", () => {
    expect(namesAnotherTitle("Narcos Mexico | Bande-annonce", [])).toBe(false);
    expect(namesAnotherTitle(undefined, RICK)).toBe(false);
  });
});
