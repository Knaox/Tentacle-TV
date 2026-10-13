import { describe, expect, it } from "vitest";
import { pinKeyOf } from "./pinKeys";
import { nextTileIndex } from "./rowKeys";

describe("la rangée de « Qui regarde ? » au clavier", () => {
  it("les flèches passent d'un profil à l'autre et bouclent", () => {
    expect(nextTileIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextTileIndex("ArrowDown", 2, 3)).toBe(0);
    expect(nextTileIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextTileIndex("ArrowUp", 1, 3)).toBe(0);
  });

  it("Début et Fin vont aux extrémités ; les autres touches ne concernent pas la rangée", () => {
    expect(nextTileIndex("Home", 2, 4)).toBe(0);
    expect(nextTileIndex("End", 0, 4)).toBe(3);
    expect(nextTileIndex("Enter", 1, 4)).toBeNull();
    expect(nextTileIndex("Tab", 1, 4)).toBeNull();
    expect(nextTileIndex("ArrowRight", 0, 0)).toBeNull();
  });
});

describe("le pavé du code PIN au clavier", () => {
  it("les chiffres, de la rangée du haut comme du pavé numérique", () => {
    for (const digit of ["0", "1", "5", "9"]) expect(pinKeyOf(digit)).toBe(digit);
  });

  it("Retour arrière et Suppr effacent, Échap revient", () => {
    expect(pinKeyOf("Backspace")).toBe("erase");
    expect(pinKeyOf("Delete")).toBe("erase");
    expect(pinKeyOf("Escape")).toBe("back");
  });

  it("le reste garde son sens (Tab, Entrée, lettres)", () => {
    for (const key of ["Tab", "Enter", "a", "ArrowLeft", " ", "10"]) expect(pinKeyOf(key)).toBeNull();
  });
});
