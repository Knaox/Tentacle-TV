import { afterEach, describe, expect, it } from "vitest";
import { configsTv, demarrerReleveConfigs, lireConfigs, reinitialiserConfigsTv } from "./configsTv";
import { deduireDalle } from "./panelWebos";

/**
 * Les valeurs de ce fichier sont RELEVÉES, pas inventées : elles viennent d'un
 * `getConfigs` exécuté sur un OLED42C37LA. C'est ce qui donne leur valeur aux
 * deux pièges qu'elles documentent — un `displayType` qui ment et une
 * définition qui ne s'écrit pas comme on l'attend.
 */

/** Le relevé complet du C3, tel que le service l'a rendu. */
const C3 = {
  "tv.model.supportDolbyVisionHDR": true,
  "tv.config.supportDolbyTVATMOS": true,
  "tv.model.supportHDR": true,
  "tv.hw.displayType": "OLED",
  "tv.model.displayType": "LCD DISPLAY",
  "tv.hw.panelResolution": "UD",
  "tv.hw.bSupport_8K_resolution": false,
};

describe("lireConfigs", () => {
  it("traduit le relevé d'un OLED C3", () => {
    expect(lireConfigs(C3)).toEqual({
      dolbyVision: true,
      dolbyAtmos: true,
      hdr: true,
      oled: true,
      uhd: true,
      uhd8K: false,
    });
  });

  it("ignore `tv.model.displayType`, qui annonce « LCD DISPLAY » sur un OLED", () => {
    // Les deux clés existent et se contredisent ; rien dans leur nom ne dit
    // laquelle décrit le matériel. Prendre la mauvaise coûterait le DTS.
    expect(lireConfigs({ "tv.model.displayType": "LCD DISPLAY" }).oled).toBeUndefined();
    expect(lireConfigs({ "tv.hw.displayType": "OLED" }).oled).toBe(true);
    expect(lireConfigs({ "tv.hw.displayType": "LCD DISPLAY" }).oled).toBe(false);
  });

  it("lit « UD », le nom que LG donne à l'ultra-définition", () => {
    expect(lireConfigs({ "tv.hw.panelResolution": "UD" }).uhd).toBe(true);
    expect(lireConfigs({ "tv.hw.panelResolution": "FHD" }).uhd).toBe(false);
    // Une définition inconnue ne conclut rien plutôt que de conclure faux.
    expect(lireConfigs({ "tv.hw.panelResolution": "XYZ" }).uhd).toBeUndefined();
  });

  it("tient une dalle 8K pour 4K, quel que soit l'ordre des clés", () => {
    expect(lireConfigs({ "tv.hw.bSupport_8K_resolution": true }))
      .toEqual({ uhd: true, uhd8K: true });
  });

  it("ne conclut RIEN d'une clé absente", () => {
    // C'est tout l'intérêt du module : une propriété absente laisse la
    // déduction par gamme reprendre la main, là où un `false` la condamnerait.
    expect(lireConfigs({})).toEqual({});
    expect(lireConfigs({ "tv.model.supportDolbyVisionHDR": "peut-être" })).toEqual({});
  });
});

/**
 * Ce module tourne sur des générations qu'on n'a pas sous la main — de webOS 3
 * à 26 — et sur des modèles dont on ignore s'ils connaissent seulement ce
 * service. **Aucun de ces cas ne doit empêcher le téléviseur de démarrer**, et
 * chacun doit rendre la main à la déduction par gamme plutôt que de conclure.
 */
describe("robustesse du relevé", () => {
  const fenetre = globalThis as { window?: unknown };
  const original = fenetre.window;

  afterEach(() => {
    if (original === undefined) delete fenetre.window;
    else fenetre.window = original;
    reinitialiserConfigsTv();
  });

  /** Un pont qui rend `reponse` au rappel, ou lève si `reponse` est une erreur. */
  function pontQuiRend(reponse: string | Error) {
    fenetre.window = {
      PalmServiceBridge: function (this: Record<string, unknown>) {
        this.onservicecallback = null;
        this.call = () => {
          if (reponse instanceof Error) throw reponse;
          (this.onservicecallback as (r: string) => void)(reponse);
        };
      },
    };
  }

  it("ne lève pas hors d'un navigateur", () => {
    delete fenetre.window;
    expect(() => demarrerReleveConfigs()).not.toThrow();
    expect(configsTv()).toEqual({});
  });

  it("ne lève pas sans pont — un navigateur de développement", () => {
    fenetre.window = {};
    expect(() => demarrerReleveConfigs()).not.toThrow();
    expect(configsTv()).toEqual({});
  });

  it("encaisse un service inconnu de cette génération", () => {
    // La forme exacte du refus de webOS : `returnValue` faux, pas de `configs`.
    pontQuiRend(JSON.stringify({ returnValue: false, errorText: "Service does not exist" }));
    demarrerReleveConfigs();
    expect(configsTv()).toEqual({});
  });

  it("encaisse un service qui ne connaît aucune de ces clés", () => {
    pontQuiRend(JSON.stringify({ returnValue: true, missingConfigs: ["tv.model.supportHDR"] }));
    demarrerReleveConfigs();
    expect(configsTv()).toEqual({});
  });

  it("encaisse une réponse illisible", () => {
    pontQuiRend("<html>pas du JSON</html>");
    demarrerReleveConfigs();
    expect(configsTv()).toEqual({});
  });

  it("encaisse un pont qui refuse l'appel", () => {
    pontQuiRend(new Error("permission denied"));
    expect(() => demarrerReleveConfigs()).not.toThrow();
    expect(configsTv()).toEqual({});
  });

  it("ne retient que les clés connues d'une réponse partielle", () => {
    // Le cas d'une génération qui n'expose qu'une partie de la table : ce
    // qu'elle sait est pris, le reste retombe sur la déduction.
    pontQuiRend(JSON.stringify({
      returnValue: true,
      configs: { "tv.model.supportHDR": true },
      missingConfigs: ["tv.config.supportDolbyTVATMOS"],
    }));
    demarrerReleveConfigs();
    expect(configsTv()).toEqual({ hdr: true });
  });

  it("ne relève qu'une fois", () => {
    pontQuiRend(JSON.stringify({ returnValue: true, configs: { "tv.model.supportHDR": true } }));
    demarrerReleveConfigs();
    fenetre.window = {};
    demarrerReleveConfigs();
    expect(configsTv()).toEqual({ hdr: true });
  });
});

describe("priorité des trois sources", () => {
  const brut = { modelName: "50UR78006LK", screenWidth: 3840, screenHeight: 2160 };

  it("laisse le relevé matériel corriger la déduction par gamme", () => {
    // La gamme UHD n'a jamais de décodeur Atmos — c'est ce que la déduction
    // conclut, et elle a raison en général. Un modèle qui déclare l'inverse a
    // le dernier mot sur la règle.
    expect(deduireDalle(brut, 2023).dolbyAtmos).toBe(false);
    expect(deduireDalle(brut, 2023, { dolbyAtmos: true }).dolbyAtmos).toBe(true);
  });

  it("laisse le relevé matériel REFUSER ce que la gamme accordait", () => {
    // Le sens qui compte le plus : ne pas promettre un décodeur absent.
    expect(deduireDalle(brut, 2023).dolbyVision).toBe(true);
    expect(deduireDalle(brut, 2023, { dolbyVision: false }).dolbyVision).toBe(false);
  });

  it("garde `deviceInfo` au-dessus du relevé", () => {
    const dalle = deduireDalle(
      { ...brut, dolbyVision: false },
      2023,
      { dolbyVision: true },
    );
    expect(dalle.dolbyVision).toBe(false);
  });

  it("retombe sur la déduction quand le relevé est vide", () => {
    // Le cas d'un téléviseur trop ancien pour connaître ces clés, ou d'une
    // réponse qui n'est pas arrivée à temps.
    expect(deduireDalle(brut, 2023, {})).toEqual(deduireDalle(brut, 2023));
  });
});
