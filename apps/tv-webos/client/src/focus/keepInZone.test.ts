import { describe, expect, it } from "vitest";
import { best, restrictToFirstRow, type Box } from "@tentacle-tv/tv-core";
import { preferZone } from "./zones";

/**
 * Relevé sur la surcouche de recherche, canevas 1920 × 1080, requête
 * « harry » : la colonne de saisie à gauche, celle des résultats à droite.
 */
interface Target {
  element: string;
  box: Box;
}

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom });

const TOP_HIT: Target = { element: "meilleur-resultat", box: box(712, 82, 1760, 382) };
const SUGGESTIONS: Target[] = [279, 347, 415, 483, 551].map((top, index) => ({
  element: `suggestion-${index + 1}`,
  box: box(96, top, 616, top + 60),
}));
const FIRST_ROW: Target[] = [0, 1, 2, 3].map((index) => ({
  element: `film-${index + 1}`,
  box: box(712 + index * 236, 483, 924 + index * 236, 883),
}));

const inResults = (element: string) => element === TOP_HIT.element || element.startsWith("film-");
const inInput = (element: string) => element.startsWith("suggestion-");

/** Le trajet complet du moteur hors grille : zone d'abord, puis première bande, puis score. */
function aim(from: Target, targets: Target[], direction: "haut" | "bas", inZone: (element: string) => boolean) {
  const others = targets.filter((target) => target !== from);
  const band = restrictToFirstRow(from.box, preferZone(from.box, others, direction, inZone), direction);
  return best(from.box, band, direction)?.element ?? null;
}

describe("déplacement vertical dans une zone", () => {
  const screen = [...SUGGESTIONS, TOP_HIT, ...FIRST_ROW];

  it("la géométrie seule prenait la suggestion pour la bande suivante", () => {
    // Le défaut, tel qu'il se produisait : la troisième suggestion est à 33 px
    // sous la bannière, la première rangée à 101 px.
    const band = restrictToFirstRow(TOP_HIT.box, screen.filter((target) => target !== TOP_HIT), "bas");
    expect(band.map((target) => target.element)).toEqual(["suggestion-3"]);
  });

  it("« bas » depuis le meilleur résultat atteint la rangée de dessous", () => {
    expect(aim(TOP_HIT, screen, "bas", inResults)).toBe("film-1");
  });

  it("« haut » depuis la première rangée rend le meilleur résultat", () => {
    expect(aim(FIRST_ROW[0], screen, "haut", inResults)).toBe("meilleur-resultat");
  });

  it("la colonne de saisie garde son propre rythme", () => {
    expect(aim(SUGGESTIONS[1], screen, "bas", inInput)).toBe("suggestion-3");
    expect(aim(SUGGESTIONS[1], screen, "haut", inInput)).toBe("suggestion-1");
  });

  it("une zone sans suite dans la direction rend la main à tout l'écran", () => {
    // Le bloc d'actions d'une fiche : rien dessous dans la zone, les saisons
    // hors d'elle. Sans ce repli, on ne descendrait plus jamais d'une zone.
    const play: Target = { element: "lecture", box: box(96, 600, 336, 668) };
    const trailer: Target = { element: "bande-annonce", box: box(352, 600, 592, 668) };
    const season: Target = { element: "saison-1", box: box(96, 760, 256, 812) };
    const inActions = (element: string) => element === "lecture" || element === "bande-annonce";
    const candidates = [trailer, season];
    expect(preferZone(play.box, candidates, "bas", inActions)).toBe(candidates);
    expect(aim(play, [play, trailer, season], "bas", inActions)).toBe("saison-1");
  });

  it("un voisin de zone qui n'est pas dans la direction ne retient rien", () => {
    // La bande-annonce est dans la zone, mais à côté : « bas » doit sortir.
    const play: Target = { element: "lecture", box: box(96, 600, 336, 668) };
    const trailer: Target = { element: "bande-annonce", box: box(352, 600, 592, 668) };
    const season: Target = { element: "saison-1", box: box(96, 760, 256, 812) };
    const inActions = (element: string) => element === "bande-annonce";
    expect(aim(play, [trailer, season], "bas", inActions)).toBe("saison-1");
  });
});
