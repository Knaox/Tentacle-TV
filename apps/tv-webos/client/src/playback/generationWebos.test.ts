import { describe, expect, it } from "vitest";
import {
  yearFromModel,
  generationFromChromium,
  generationFromSdk,
  readPlatform,
  versionChromium,
} from "./generationWebos";

/**
 * Ce que ce module décide gouverne tout le profil d'appareil — et rien de ce
 * qu'il lit n'est disponible sur un poste de développement. Les chaînes ci-
 * dessous sont donc les vraies : agents utilisateurs publiés par LG, noms de
 * modèles du commerce, et le `sdkVersion` que rend notre émulateur webOS 4.
 */

/** Agent utilisateur d'une application webOS, tel que LG le publie. */
function agentLg(chromium: string): string {
  return (
    "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) " +
    `Chrome/${chromium} Safari/537.36 WebAppManager`
  );
}

describe("versionChromium", () => {
  it("lit le moteur d'un agent webOS", () => {
    expect(versionChromium(agentLg("53.0.2785.34"))).toBe(53);
    expect(versionChromium(agentLg("132.0.6834.207"))).toBe(132);
  });

  it("accepte « Chr0me » avec un zéro — des firmwares LG l'écrivent ainsi", () => {
    expect(versionChromium(agentLg("79.0.3945.79").replace("Chrome", "Chr0me"))).toBe(79);
  });

  it("refuse de conclure sur le navigateur intégré", () => {
    // Le numéro de Chromium de NetCast ne décrit pas le moteur qui exécute
    // l'application : mieux vaut le repli qu'un chiffre faux.
    const browser =
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 " +
      "Safari/537.36 LG Browser/8.00.00 webOS.TV-2021; LG NetCast.TV-2013 Compatible";
    expect(versionChromium(browser)).toBeNull();
  });

  it("rend null sur un agent sans Chromium", () => {
    expect(versionChromium("Mozilla/5.0 (Macintosh) Safari/605.1.15")).toBeNull();
  });
});

describe("generationDepuisChromium", () => {
  it("associe chaque moteur publié par LG à sa génération", () => {
    const expected: [number, number][] = [
      [38, 3], [53, 4], [68, 5], [79, 6],
      [87, 22], [94, 23], [108, 24], [120, 25], [132, 26],
    ];
    for (const [chromium, generation] of expected) {
      expect(generationFromChromium(chromium)).toBe(generation);
    }
  });

  it("arrondit vers le bas entre deux paliers", () => {
    // Aucun firmware ne publie 100, mais rien n'interdit qu'il en sorte un :
    // il doit être traité comme la génération dont il dépasse le seuil.
    expect(generationFromChromium(100)).toBe(23);
    expect(generationFromChromium(60)).toBe(4);
  });

  it("ne conclut rien sous le premier palier", () => {
    expect(generationFromChromium(34)).toBeNull();
  });

  it("suit un moteur plus récent que la table", () => {
    expect(generationFromChromium(140)).toBe(26);
  });
});

describe("generationDepuisSdk", () => {
  it("lit la version de notre émulateur", () => {
    expect(generationFromSdk("04.00.00")).toBe(4);
  });

  it("lit une version non rembourrée", () => {
    expect(generationFromSdk("6.0.0")).toBe(6);
  });

  it("refuse au-delà de 6 — la numérotation interne s'y détache de la marketing", () => {
    // Un téléviseur de 2022 rend « 7.2.0-47 » : lire 7 donnerait une génération
    // qui n'existe pas.
    expect(generationFromSdk("7.2.0-47")).toBeNull();
  });

  it("rend null sur un champ absent ou illisible", () => {
    expect(generationFromSdk(undefined)).toBeNull();
    expect(generationFromSdk("")).toBeNull();
    expect(generationFromSdk("inconnu")).toBeNull();
  });
});

describe("anneeDepuisModele", () => {
  it("décode les dalles OLED", () => {
    expect(yearFromModel("OLED55C3PUA", 23)).toBe(2023);
    expect(yearFromModel("OLED65G2LA", 22)).toBe(2022);
    expect(yearFromModel("OLED55C9PLA", 5)).toBe(2019);
  });

  it("décode le millésime « X » de 2020, qui ne s'ordonne pas", () => {
    expect(yearFromModel("OLED65CXPUA", 5)).toBe(2020);
  });

  it("départage C6 par la génération — la lettre de gamme a fait le tour", () => {
    expect(yearFromModel("OLED55C6P", 3)).toBe(2016);
    expect(yearFromModel("OLED55C6", 26)).toBe(2026);
  });

  it("décode les dalles LCD, NanoCell et QNED", () => {
    expect(yearFromModel("65UM7400PLB", 4)).toBe(2019);
    expect(yearFromModel("65QNED85TA", 24)).toBe(2024);
  });

  it("décode le millésime qu'il soit sur deux ou trois chiffres de série", () => {
    // Amérique et Europe n'écrivent pas la même chose pour la même année.
    expect(yearFromModel("65NANO86TNA", 24)).toBe(2024);
    expect(yearFromModel("65NANO866NA", 5)).toBe(2020);
  });

  it("rend null plutôt que de deviner", () => {
    expect(yearFromModel(undefined, 24)).toBeNull();
    // Le modelName de notre émulateur : aucune année à en tirer.
    expect(yearFromModel("WEBOS4.0", 4)).toBeNull();
    expect(yearFromModel("", 24)).toBeNull();
    // Un `U` de gamme là où d'autres portent l'année.
    expect(yearFromModel("65NANO85UNA", 5)).toBeNull();
  });
});

describe("lirePlateforme", () => {
  it("préfère l'agent utilisateur — c'est le moteur qui parle du engine", () => {
    // `sdkVersion` dit 4, l'agent dit Chromium 120. C'est le cas « Re:New » :
    // webOS 25 poussé sur un téléviseur plus ancien.
    const platform = readPlatform(
      { sdkVersion: "04.00.00", modelName: "OLED65C2LA" },
      agentLg("120.0.6099.270"),
    );
    expect(platform.generation).toBe(25);
    expect(platform.source).toBe("ua");
  });

  it("garde l'année du MATÉRIEL quand le logiciel a été mis à jour", () => {
    // Le cœur du problème : ce C2 gagne le Dolby Vision en MKV (logiciel) et ne
    // gagne ni AV1 ni DTS (matériel de 2022).
    const platform = readPlatform({ modelName: "OLED65C2LA" }, agentLg("120.0.6099.270"));
    expect(platform.generation).toBe(25);
    expect(platform.year).toBe(2022);
  });

  it("retombe sur sdkVersion quand l'agent ne dit rien", () => {
    const platform = readPlatform({ sdkVersion: "04.00.00" }, "agent inconnu");
    expect(platform.generation).toBe(4);
    expect(platform.source).toBe("sdk");
  });

  it("retombe sur webOS 4 quand rien n'est lisible", () => {
    const platform = readPlatform({}, "");
    expect(platform.generation).toBe(4);
    expect(platform.year).toBeNull();
    expect(platform.source).toBe("repli");
  });

  it("tient face à un deviceInfo amputé — le cas documenté par LG", () => {
    // Des téléviseurs réels ne rendent que modelName, screenWidth et
    // screenHeight. La génération doit survivre à cette absence.
    const platform = readPlatform(
      { modelName: "OLED55C3PUA", screenWidth: 3840, screenHeight: 2160 },
      agentLg("94.0.4606.128"),
    );
    expect(platform.generation).toBe(23);
    expect(platform.year).toBe(2023);
  });
});
