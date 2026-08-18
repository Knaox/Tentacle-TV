import { describe, expect, it } from "vitest";
import type { CapacitesTeleviseur } from "../bootstrap/webosGlobals";
import {
  deduireDalle,
  dolbyAtmosDeGamme,
  dolbyVisionDeGamme,
  gammeDepuisModele,
} from "./panelWebos";
import { anneeDepuisModele, type GenerationWebos } from "./generationWebos";

/**
 * La déduction doit tenir dans les DEUX sens, et c'est tout l'enjeu de ce
 * fichier. Accorder trop, c'est une image délavée ou une piste muette sur une
 * dalle d'entrée de gamme ; accorder trop peu, c'est recompresser du 4K sur un
 * téléviseur qui l'affichait sans effort. Aucune des deux erreurs ne se voit
 * sur un poste de développement.
 *
 * Les modèles cités sont réels, et choisis pour encadrer chaque bascule.
 */

/** Un `deviceInfo` de dalle 4K, aussi avare que celui d'un vrai téléviseur. */
function info(modelName: string, extra: Partial<CapacitesTeleviseur> = {}): CapacitesTeleviseur {
  return { modelName, screenWidth: 3840, screenHeight: 2160, ...extra };
}

/** La déduction complète, comme `resoudreProfil` l'enchaîne. */
function dalleDe(
  modelName: string,
  generation: GenerationWebos = 23,
  extra: Partial<CapacitesTeleviseur> = {},
) {
  return deduireDalle(info(modelName, extra), anneeDepuisModele(modelName, generation));
}

describe("gammeDepuisModele", () => {
  it("lit `panelType`, le seul champ de capacité que LG renseigne vraiment", () => {
    // Le C3 réel : ni `oled`, ni `dolbyVision`, ni `hdr10` — mais `panelType`.
    expect(gammeDepuisModele({ modelName: "OLED42C37LA", panelType: "OLED" })).toBe("oled");
    // Et il tranche même quand le nom ne dit rien.
    expect(gammeDepuisModele({ modelName: "MODELE-INCONNU", panelType: "OLED" })).toBe("oled");
  });

  it("classe les quatre gammes par leur nom de modèle", () => {
    expect(gammeDepuisModele({ modelName: "OLED65G4WUA" })).toBe("oled");
    expect(gammeDepuisModele({ modelName: "65QNED866RE" })).toBe("qned");
    expect(gammeDepuisModele({ modelName: "55NANO866NA" })).toBe("nano");
    expect(gammeDepuisModele({ modelName: "50UR78006LK" })).toBe("uhd");
    expect(gammeDepuisModele({ modelName: "43UQ75006LF" })).toBe("uhd");
  });

  it("ne classe pas ce qu'elle ne sait pas lire", () => {
    // Une dalle FHD d'entrée de gamme.
    expect(gammeDepuisModele({ modelName: "32LM630BPLA" })).toBe(null);
    // Les Super UHD de 2018, qui ont pourtant le Dolby Vision : les reconnaître
    // demanderait une table de préfixes que LG ne publie pas. Ne rien accorder
    // coûte un transcodage ; se tromper coûterait l'image.
    expect(gammeDepuisModele({ modelName: "65SK8000PLA" })).toBe(null);
    expect(gammeDepuisModele({})).toBe(null);
  });
});

describe("dolbyVisionDeGamme", () => {
  it("l'accorde à toute dalle OLED, quelle que soit l'année", () => {
    // Argument de vente de la gamme depuis 2016, jamais une option de modèle.
    expect(dolbyVisionDeGamme("oled", 2016)).toBe(true);
    expect(dolbyVisionDeGamme("oled", 2024)).toBe(true);
    // Un nom illisible ne retire rien à une dalle dont la gamme est établie.
    expect(dolbyVisionDeGamme("oled", null)).toBe(true);
  });

  it("le refuse à la gamme UHD d'avant 2019", () => {
    // LG le généralise à la gamme UHD en 2019 ; les UK de 2018 ne l'ont pas.
    expect(dolbyVisionDeGamme("uhd", 2018)).toBe(false);
    expect(dolbyVisionDeGamme("uhd", 2019)).toBe(true);
    expect(dolbyVisionDeGamme("uhd", null)).toBe(false);
  });

  it("ne l'accorde jamais à une gamme inconnue", () => {
    expect(dolbyVisionDeGamme(null, 2024)).toBe(false);
  });
});

describe("dolbyAtmosDeGamme", () => {
  it("suit l'arrivée du décodeur, gamme par gamme", () => {
    // Les B6, C6 et E6 de 2016 n'ont pas l'Atmos ; il arrive en 2017.
    expect(dolbyAtmosDeGamme("oled", 2016)).toBe(false);
    expect(dolbyAtmosDeGamme("oled", 2017)).toBe(true);
    expect(dolbyAtmosDeGamme("nano", 2019)).toBe(false);
    expect(dolbyAtmosDeGamme("nano", 2020)).toBe(true);
    // La gamme QNED naît en 2021, après le décodeur : son nom suffit.
    expect(dolbyAtmosDeGamme("qned", null)).toBe(true);
  });

  it("ne l'accorde jamais à la gamme UHD, qui reçoit du DD+ sans couche objet", () => {
    expect(dolbyAtmosDeGamme("uhd", 2024)).toBe(false);
    expect(dolbyAtmosDeGamme(null, 2024)).toBe(false);
  });
});

describe("deduireDalle", () => {
  it("accorde tout à l'OLED C3 dont `deviceInfo` ne dit rien", () => {
    // Le relevé réel : huit champs, aucun booléen de capacité.
    const dalle = deduireDalle(
      {
        modelName: "OLED42C37LA",
        panelType: "OLED",
        screenWidth: 3840,
        screenHeight: 2160,
      },
      2023,
    );
    expect(dalle).toEqual({
      uhd: true,
      uhd8K: false,
      hdr10: true,
      dolbyVision: true,
      dolbyAtmos: true,
      oled: true,
    });
  });

  it("n'accorde rien à une dalle FHD d'entrée de gamme", () => {
    const dalle = deduireDalle(
      { modelName: "32LM630BPLA", screenWidth: 1920, screenHeight: 1080 },
      2019,
    );
    expect(dalle).toEqual({
      uhd: false,
      uhd8K: false,
      hdr10: false,
      dolbyVision: false,
      dolbyAtmos: false,
      oled: false,
    });
  });

  it("distingue deux gammes UHD que trois ans séparent", () => {
    const ancienne = dalleDe("43UK6300PLB");
    expect(ancienne.dolbyVision).toBe(false);
    expect(ancienne.dolbyAtmos).toBe(false);

    const recente = dalleDe("50UR78006LK");
    expect(recente.dolbyVision).toBe(true);
    // La gamme UHD n'a jamais eu de décodeur Atmos, même en 2023.
    expect(recente.dolbyAtmos).toBe(false);
  });

  it("voit le 8K à la définition de l'écran", () => {
    const dalle = deduireDalle(
      { modelName: "OLED88Z9PUA", panelType: "OLED", screenWidth: 7680, screenHeight: 4320 },
      2019,
    );
    expect(dalle.uhd).toBe(true);
    expect(dalle.uhd8K).toBe(true);
    expect(dalle.dolbyVision).toBe(true);
  });

  it("laisse le dernier mot à un champ déclaré, y compris pour refuser", () => {
    // Le jour où LG renseigne ses booléens, ils priment sur toute déduction :
    // celle-ci comble un trou, elle ne contredit pas.
    const refus = deduireDalle(
      { modelName: "OLED42C37LA", panelType: "OLED", dolbyVision: false, dolbyAtmos: false },
      2023,
    );
    expect(refus.dolbyVision).toBe(false);
    expect(refus.dolbyAtmos).toBe(false);
    // Et le sens inverse : une dalle qui se déclare capable est crue.
    const aveu = deduireDalle({ modelName: "43UK6300PLB", dolbyVision: true }, 2018);
    expect(aveu.dolbyVision).toBe(true);
  });
});
