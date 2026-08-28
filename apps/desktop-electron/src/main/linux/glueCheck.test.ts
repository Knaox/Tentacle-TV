import { describe, expect, it } from "vitest";
import { descriptionMesure, nombreMpv, verdictColle } from "./glueCheck";

/**
 * Le témoin doit trancher deux mondes — une fenêtre mpv à la taille de l'hôte,
 * ou une fenêtre libre née à la taille du clip — sans jamais crier au loup
 * quand la mesure manque.
 */

describe("nombreMpv", () => {
  it("lit ce que mpv rend en texte, refuse le reste", () => {
    expect(nombreMpv("1920")).toBe(1920);
    expect(nombreMpv(" 828.0 ")).toBe(828);
    expect(nombreMpv(null)).toBeNull();
    expect(nombreMpv("")).toBeNull();
    // Une sortie vidéo pas encore montée rend zéro : ce n'est pas une taille.
    expect(nombreMpv("0")).toBeNull();
    expect(nombreMpv("non")).toBeNull();
  });
});

describe("verdictColle", () => {
  const hote = { largeur: 1152, hauteur: 828 };

  it("collée : la fenêtre mpv a la taille de l'hôte, à l'échelle près", () => {
    expect(verdictColle({ largeur: 2304, hauteur: 1656 }, hote, 2)).toBe("collée");
    expect(verdictColle({ largeur: 1152, hauteur: 828 }, hote, 1)).toBe("collée");
    // Décorations et échelle fractionnaire : quelques points d'écart passent.
    expect(verdictColle({ largeur: 1152, hauteur: 866 }, hote, 1)).toBe("collée");
  });

  it("libre : la fenêtre est née à la taille du clip, la colle n'a rien fait", () => {
    expect(verdictColle({ largeur: 1920, hauteur: 1080 }, hote, 1)).toBe("libre");
    // Le piège du poste 4K : l'échelle doit être appliquée, sinon tout est faux.
    expect(verdictColle({ largeur: 1152, hauteur: 828 }, hote, 2)).toBe("libre");
  });

  it("indécidable : mesure absente, fenêtre réduite, échelle absurde", () => {
    expect(verdictColle(null, hote, 2)).toBe("indécidable");
    expect(verdictColle({ largeur: 100, hauteur: 0 }, hote, 2)).toBe("indécidable");
    expect(verdictColle({ largeur: 100, hauteur: 100 }, { largeur: 0, hauteur: 0 }, 2)).toBe(
      "indécidable",
    );
    expect(verdictColle({ largeur: 100, hauteur: 100 }, hote, 0)).toBe("indécidable");
  });
});

describe("descriptionMesure", () => {
  it("dit les DEUX tailles — un verdict seul ne se relit pas", () => {
    expect(descriptionMesure({ largeur: 1920, hauteur: 1080 }, { largeur: 1152, hauteur: 828 }, 2))
      .toBe("mpv 1920x1080 · attendu 2304x1656 (hôte 1152x828 ×2)");
    expect(descriptionMesure(null, { largeur: 800, hauteur: 600 }, 1)).toContain("mpv ?");
  });
});
