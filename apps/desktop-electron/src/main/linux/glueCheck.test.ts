import { describe, expect, it } from "vitest";
import { measureDescription, mpvNumber, glueVerdict } from "./glueCheck";

/**
 * Le témoin doit trancher deux mondes — une fenêtre mpv à la taille de l'hôte,
 * ou une fenêtre libre née à la taille du clip — sans jamais crier au loup
 * quand la mesure manque.
 */

describe("nombreMpv", () => {
  it("lit ce que mpv rend en texte, refuse le reste", () => {
    expect(mpvNumber("1920")).toBe(1920);
    expect(mpvNumber(" 828.0 ")).toBe(828);
    expect(mpvNumber(null)).toBeNull();
    expect(mpvNumber("")).toBeNull();
    // Une sortie vidéo pas encore montée rend zéro : ce n'est pas une taille.
    expect(mpvNumber("0")).toBeNull();
    expect(mpvNumber("non")).toBeNull();
  });
});

describe("verdictColle", () => {
  const host = { width: 1152, height: 828 };

  it("collée : la fenêtre mpv a la taille de l'hôte, à l'échelle près", () => {
    expect(glueVerdict({ width: 2304, height: 1656 }, host, 2)).toBe("collée");
    expect(glueVerdict({ width: 1152, height: 828 }, host, 1)).toBe("collée");
    // Décorations et échelle fractionnaire : quelques points d'écart passent.
    expect(glueVerdict({ width: 1152, height: 866 }, host, 1)).toBe("collée");
  });

  it("libre : la fenêtre est née à la taille du clip, la colle n'a rien fait", () => {
    expect(glueVerdict({ width: 1920, height: 1080 }, host, 1)).toBe("libre");
    // Le piège du poste 4K : l'échelle doit être appliquée, sinon tout est faux.
    expect(glueVerdict({ width: 1152, height: 828 }, host, 2)).toBe("libre");
  });

  it("indécidable : mesure absente, fenêtre réduite, échelle absurde", () => {
    expect(glueVerdict(null, host, 2)).toBe("indécidable");
    expect(glueVerdict({ width: 100, height: 0 }, host, 2)).toBe("indécidable");
    expect(glueVerdict({ width: 100, height: 100 }, { width: 0, height: 0 }, 2)).toBe(
      "indécidable",
    );
    expect(glueVerdict({ width: 100, height: 100 }, host, 0)).toBe("indécidable");
  });
});

describe("descriptionMesure", () => {
  it("dit les DEUX tailles — un verdict seul ne se relit pas", () => {
    expect(measureDescription({ width: 1920, height: 1080 }, { width: 1152, height: 828 }, 2))
      .toBe("mpv 1920x1080 · attendu 2304x1656 (hôte 1152x828 ×2)");
    expect(measureDescription(null, { width: 800, height: 600 }, 1)).toContain("mpv ?");
  });
});
