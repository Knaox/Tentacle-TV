import { afterEach, describe, expect, it } from "vitest";
import { configsTv, startConfigCapture, readConfigs, resetTvConfigs } from "./configsTv";
import { inferPanel } from "./panelWebos";

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

describe("readConfigs", () => {
  it("traduit le relevé d'un OLED C3", () => {
    expect(readConfigs(C3)).toEqual({
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
    expect(readConfigs({ "tv.model.displayType": "LCD DISPLAY" }).oled).toBeUndefined();
    expect(readConfigs({ "tv.hw.displayType": "OLED" }).oled).toBe(true);
    expect(readConfigs({ "tv.hw.displayType": "LCD DISPLAY" }).oled).toBe(false);
  });

  it("lit « UD », le nom que LG donne à l'ultra-définition", () => {
    expect(readConfigs({ "tv.hw.panelResolution": "UD" }).uhd).toBe(true);
    expect(readConfigs({ "tv.hw.panelResolution": "FHD" }).uhd).toBe(false);
    // Une définition inconnue ne conclut rien plutôt que de conclure faux.
    expect(readConfigs({ "tv.hw.panelResolution": "XYZ" }).uhd).toBeUndefined();
  });

  it("tient une dalle 8K pour 4K, quel que soit l'ordre des clés", () => {
    expect(readConfigs({ "tv.hw.bSupport_8K_resolution": true }))
      .toEqual({ uhd: true, uhd8K: true });
  });

  it("ne conclut RIEN d'une clé absente", () => {
    // C'est tout l'intérêt du module : une propriété absente laisse la
    // déduction par gamme reprendre la main, là où un `false` la condamnerait.
    expect(readConfigs({})).toEqual({});
    expect(readConfigs({ "tv.model.supportDolbyVisionHDR": "peut-être" })).toEqual({});
  });
});

/**
 * Ce module tourne sur des générations qu'on n'a pas sous la main — de webOS 3
 * à 26 — et sur des modèles dont on ignore s'ils connaissent seulement ce
 * service. **Aucun de ces cas ne doit empêcher le téléviseur de démarrer**, et
 * chacun doit rendre la main à la déduction par gamme plutôt que de conclure.
 */
describe("robustesse du relevé", () => {
  const window = globalThis as { window?: unknown };
  const original = window.window;

  afterEach(() => {
    if (original === undefined) delete window.window;
    else window.window = original;
    resetTvConfigs();
  });

  /** Un pont qui rend `response` au rappel, ou lève si `response` est une erreur. */
  function bridgeThatAnswers(response: string | Error) {
    window.window = {
      PalmServiceBridge: function (this: Record<string, unknown>) {
        this.onservicecallback = null;
        this.call = () => {
          if (response instanceof Error) throw response;
          (this.onservicecallback as (r: string) => void)(response);
        };
      },
    };
  }

  it("ne lève pas hors d'un navigateur", () => {
    delete window.window;
    expect(() => startConfigCapture()).not.toThrow();
    expect(configsTv()).toEqual({});
  });

  it("ne lève pas sans pont — un navigateur de développement", () => {
    window.window = {};
    expect(() => startConfigCapture()).not.toThrow();
    expect(configsTv()).toEqual({});
  });

  it("encaisse un service inconnu de cette génération", () => {
    // La forme exacte du refus de webOS : `returnValue` faux, pas de `configs`.
    bridgeThatAnswers(JSON.stringify({ returnValue: false, errorText: "Service does not exist" }));
    startConfigCapture();
    expect(configsTv()).toEqual({});
  });

  it("encaisse un service qui ne connaît aucune de ces clés", () => {
    bridgeThatAnswers(JSON.stringify({ returnValue: true, missingConfigs: ["tv.model.supportHDR"] }));
    startConfigCapture();
    expect(configsTv()).toEqual({});
  });

  it("encaisse une réponse illisible", () => {
    bridgeThatAnswers("<html>pas du JSON</html>");
    startConfigCapture();
    expect(configsTv()).toEqual({});
  });

  it("encaisse un pont qui refuse l'appel", () => {
    bridgeThatAnswers(new Error("permission denied"));
    expect(() => startConfigCapture()).not.toThrow();
    expect(configsTv()).toEqual({});
  });

  it("ne retient que les clés connues d'une réponse partielle", () => {
    // Le cas d'une génération qui n'expose qu'une partie de la table : ce
    // qu'elle sait est pris, le reste retombe sur la déduction.
    bridgeThatAnswers(JSON.stringify({
      returnValue: true,
      configs: { "tv.model.supportHDR": true },
      missingConfigs: ["tv.config.supportDolbyTVATMOS"],
    }));
    startConfigCapture();
    expect(configsTv()).toEqual({ hdr: true });
  });

  it("ne relève qu'une fois", () => {
    bridgeThatAnswers(JSON.stringify({ returnValue: true, configs: { "tv.model.supportHDR": true } }));
    startConfigCapture();
    window.window = {};
    startConfigCapture();
    expect(configsTv()).toEqual({ hdr: true });
  });
});

describe("priorité des trois sources", () => {
  const raw = { modelName: "50UR78006LK", screenWidth: 3840, screenHeight: 2160 };

  it("laisse le relevé matériel corriger la déduction par gamme", () => {
    // La gamme UHD n'a jamais de décodeur Atmos — c'est ce que la déduction
    // conclut, et elle a raison en général. Un modèle qui déclare l'inverse a
    // le dernier mot sur la règle.
    expect(inferPanel(raw, 2023).dolbyAtmos).toBe(false);
    expect(inferPanel(raw, 2023, { dolbyAtmos: true }).dolbyAtmos).toBe(true);
  });

  it("laisse le relevé matériel REFUSER ce que la gamme accordait", () => {
    // Le sens qui compte le plus : ne pas promettre un décodeur absent.
    expect(inferPanel(raw, 2023).dolbyVision).toBe(true);
    expect(inferPanel(raw, 2023, { dolbyVision: false }).dolbyVision).toBe(false);
  });

  it("garde `deviceInfo` au-dessus du relevé", () => {
    const panel = inferPanel(
      { ...raw, dolbyVision: false },
      2023,
      { dolbyVision: true },
    );
    expect(panel.dolbyVision).toBe(false);
  });

  it("retombe sur la déduction quand le relevé est vide", () => {
    // Le cas d'un téléviseur trop ancien pour connaître ces clés, ou d'une
    // réponse qui n'est pas arrivée à temps.
    expect(inferPanel(raw, 2023, {})).toEqual(inferPanel(raw, 2023));
  });
});
