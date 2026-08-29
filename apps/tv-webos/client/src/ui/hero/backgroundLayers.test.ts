import { describe, expect, it } from "vitest";
import { next, type CalqueFond } from "./backgroundLayers";

/**
 * Ce que la machine des calques doit tenir, et qu'un rendu ne montrerait pas.
 *
 * Les trois défauts qu'elle referme se ressemblent à l'écran — le fond
 * clignote — mais ils n'ont pas la même cause. Les distinguer ici évite de
 * croire l'un réglé parce que l'autre l'est.
 */

const A = "https://serveur/Items/aaa/Images/Backdrop";
const B = "https://serveur/Items/bbb/Images/Backdrop";

function present(url: string): CalqueFond {
  return { url, leaving: false };
}

describe("suivant", () => {
  it("monte un premier calque quand il n'y a rien", () => {
    expect(next([], A)).toEqual([present(A)]);
  });

  it("garde le calque en place quand l'image ne change pas", () => {
    const currents = [present(A)];
    // Identité de référence : rien ne doit être re-rendu. C'est le cas de deux
    // épisodes d'une même série, qui empruntent le même Backdrop.
    expect(next(currents, A)).toBe(currents);
  });

  it("empile l'entrant PAR-DESSUS le sortant, sans passer par le vide", () => {
    expect(next([present(A)], B)).toEqual([present(A), present(B)]);
  });

  it("ne tient jamais plus de deux calques", () => {
    const two = [present(A), present(B)];
    const three = next(two, "https://serveur/Items/ccc/Images/Backdrop");
    expect(three).toHaveLength(2);
    expect(three[0]).toEqual(present(B));
  });

  it("marque le dernier calque sortant quand il n'y a plus rien à montrer", () => {
    expect(next([present(A)], null)).toEqual([{ url: A, leaving: true }]);
  });

  it("ne remarque pas un calque déjà sortant", () => {
    const currents = [{ url: A, leaving: true }];
    expect(next(currents, null)).toBe(currents);
  });

  it("ne fait rien quand il n'y a rien à effacer", () => {
    const vide: CalqueFond[] = [];
    expect(next(vide, null)).toBe(vide);
  });

  it("annule le départ d'un calque qui revient, plutôt que d'en monter un second", () => {
    expect(next([{ url: A, leaving: true }], A)).toEqual([present(A)]);
  });

  it("écarte les sortants du socle quand une image neuve arrive", () => {
    expect(next([{ url: A, leaving: true }], B)).toEqual([present(B)]);
  });
});
