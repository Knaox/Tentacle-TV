import { describe, expect, it } from "vitest";
import { suivant, type CalqueFond } from "./calquesFond";

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
  return { url, sortant: false };
}

describe("suivant", () => {
  it("monte un premier calque quand il n'y a rien", () => {
    expect(suivant([], A)).toEqual([present(A)]);
  });

  it("garde le calque en place quand l'image ne change pas", () => {
    const actuels = [present(A)];
    // Identité de référence : rien ne doit être re-rendu. C'est le cas de deux
    // épisodes d'une même série, qui empruntent le même Backdrop.
    expect(suivant(actuels, A)).toBe(actuels);
  });

  it("empile l'entrant PAR-DESSUS le sortant, sans passer par le vide", () => {
    expect(suivant([present(A)], B)).toEqual([present(A), present(B)]);
  });

  it("ne tient jamais plus de deux calques", () => {
    const deux = [present(A), present(B)];
    const trois = suivant(deux, "https://serveur/Items/ccc/Images/Backdrop");
    expect(trois).toHaveLength(2);
    expect(trois[0]).toEqual(present(B));
  });

  it("marque le dernier calque sortant quand il n'y a plus rien à montrer", () => {
    expect(suivant([present(A)], null)).toEqual([{ url: A, sortant: true }]);
  });

  it("ne remarque pas un calque déjà sortant", () => {
    const actuels = [{ url: A, sortant: true }];
    expect(suivant(actuels, null)).toBe(actuels);
  });

  it("ne fait rien quand il n'y a rien à effacer", () => {
    const vide: CalqueFond[] = [];
    expect(suivant(vide, null)).toBe(vide);
  });

  it("annule le départ d'un calque qui revient, plutôt que d'en monter un second", () => {
    expect(suivant([{ url: A, sortant: true }], A)).toEqual([present(A)]);
  });

  it("écarte les sortants du socle quand une image neuve arrive", () => {
    expect(suivant([{ url: A, sortant: true }], B)).toEqual([present(B)]);
  });
});
