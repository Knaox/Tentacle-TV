import { describe, expect, it } from "vitest";
import { nextTileIndex, type TileBox } from "./gridKeys";

// Deux sections : « Votre photo » (une tuile seule), puis une collection de
// cinq tuiles repliée sur trois colonnes.
const boxes: TileBox[] = [
  { top: 0, center: 50 },
  { top: 140, center: 50 }, { top: 140, center: 150 }, { top: 140, center: 250 },
  { top: 260, center: 50 }, { top: 260, center: 150 },
];

describe("les flèches dans la galerie des avatars", () => {
  it("gauche et droite suivent l'ordre de lecture, sans boucler", () => {
    expect(nextTileIndex(boxes, 0, "ArrowRight")).toBe(1);
    expect(nextTileIndex(boxes, 3, "ArrowRight")).toBe(4);
    expect(nextTileIndex(boxes, 5, "ArrowRight")).toBeNull();
    expect(nextTileIndex(boxes, 0, "ArrowLeft")).toBeNull();
  });

  it("bas et haut vont à la tuile la plus proche sur la rangée voisine", () => {
    expect(nextTileIndex(boxes, 0, "ArrowDown")).toBe(1);
    expect(nextTileIndex(boxes, 3, "ArrowDown")).toBe(5);
    expect(nextTileIndex(boxes, 5, "ArrowUp")).toBe(2);
    expect(nextTileIndex(boxes, 2, "ArrowUp")).toBe(0);
    expect(nextTileIndex(boxes, 4, "ArrowDown")).toBeNull();
    expect(nextTileIndex(boxes, 0, "ArrowUp")).toBeNull();
  });

  it("Début et Fin vont aux extrémités ; une autre touche ne fait rien", () => {
    expect(nextTileIndex(boxes, 3, "Home")).toBe(0);
    expect(nextTileIndex(boxes, 3, "End")).toBe(5);
    expect(nextTileIndex(boxes, 0, "Home")).toBeNull();
    expect(nextTileIndex(boxes, 3, "Enter")).toBeNull();
  });
});
