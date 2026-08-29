import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { connectorForLabel, displayForMeasure, connectedDisplays, edidName } from "./displays";

/** Un EDID minimal portant un nom de moniteur dans le descripteur 0xFC. */
function edid(name: string): Buffer {
  const b = Buffer.alloc(128);
  b[54 + 3] = 0xfc;
  b.write(`${name}\n`, 54 + 5, "ascii");
  return b;
}

describe("nomEdid", () => {
  it("lit le nom du moniteur", () => {
    expect(edidName(edid("DELL S2721DGF"))).toBe("DELL S2721DGF");
  });

  it("rend null sur un EDID tronqué ou sans descripteur de nom", () => {
    expect(edidName(Buffer.alloc(64))).toBeNull();
    expect(edidName(Buffer.alloc(128))).toBeNull();
  });
});

describe("ecransConnectes", () => {
  it("ne retient que les connecteurs branchés, et en tire le nom court", () => {
    const root = mkdtempSync(path.join(tmpdir(), "drm-"));
    for (const [folder, status, name] of [
      ["card2-DP-3", "connected", "DELL S2721DGF"],
      ["card2-DP-4", "connected", "XG27UCDMG"],
      ["card2-HDMI-A-1", "disconnected", "TV SALON"],
    ] as const) {
      mkdirSync(path.join(root, folder));
      writeFileSync(path.join(root, folder, "status"), `${status}\n`);
      writeFileSync(path.join(root, folder, "edid"), edid(name));
    }
    // `version` et `card2` traînent dans ce dossier : ils ne sont pas des écrans.
    mkdirSync(path.join(root, "card2"));
    writeFileSync(path.join(root, "version"), "drm 1.1.0\n");

    expect(connectedDisplays(root)).toEqual([
      { connector: "DP-3", name: "DELL S2721DGF" },
      { connector: "DP-4", name: "XG27UCDMG" },
    ]);
  });

  it("ne lève jamais, même sans /sys", () => {
    expect(connectedDisplays("/inexistant/xyz")).toEqual([]);
  });
});

describe("connecteurPourLibelle", () => {
  const displays = [
    { connector: "DP-2", name: "Odyssey G40B" },
    { connector: "DP-3", name: "DELL S2721DGF" },
    { connector: "DP-4", name: "XG27UCDMG" },
  ];

  it("rapproche les libellés réels d'Electron de leur connecteur", () => {
    // Relevés tels quels sur le poste de mesure.
    expect(connectorForLabel("Dell Inc. DELL S2721DGF", displays)).toBe("DP-3");
    expect(connectorForLabel("ASUSTek COMPUTER INC XG27UCDMG", displays)).toBe("DP-4");
    expect(connectorForLabel("Samsung Electric Company Odyssey G40B", displays)).toBe("DP-2");
  });

  it("ignore la casse, les espaces et la ponctuation", () => {
    expect(connectorForLabel("dell inc.  dell-s2721dgf", displays)).toBe("DP-3");
  });

  it("préfère le nom le plus long quand deux se ressemblent", () => {
    const range = [
      { connector: "DP-1", name: "XG27" },
      { connector: "DP-4", name: "XG27UCDMG" },
    ];
    expect(connectorForLabel("ASUSTek XG27UCDMG", range)).toBe("DP-4");
  });

  it("rend null plutôt qu'un mauvais écran quand rien ne correspond", () => {
    expect(connectorForLabel("Écran inconnu", displays)).toBeNull();
    expect(connectorForLabel("", displays)).toBeNull();
  });
});

/**
 * Sur Wayland, `getBounds()` rend (0,0) pour TOUTE fenêtre — mesuré sur ce
 * poste à trois écrans, la fenêtre en plein écran sur l'ASUS rendait `x=0 y=0`.
 * `getDisplayMatching` désignait donc l'écran posé à l'origine (le Dell), et
 * mpv partait sur le mauvais moniteur. La mesure faite par la PAGE — taille
 * logique et densité de sa fenêtre plein écran — identifie l'écran, elle.
 */
describe("ecranPourMesure", () => {
  const DISPLAY_FIXTURES = [
    { label: "Dell Inc. DELL S2721DGF", width: 1152, height: 2048, density: 1.25 },
    { label: "ASUSTek COMPUTER INC XG27UCDMG", width: 1920, height: 1080, density: 2 },
    { label: "Samsung Electric Company Odyssey G40B", width: 1920, height: 1080, density: 1 },
  ];

  it("désigne l'écran dont la taille ET la densité correspondent", () => {
    // Mêmes 1920x1080 que le Samsung : c'est la DENSITÉ qui les sépare.
    expect(displayForMeasure({ width: 1920, height: 1080, density: 2 }, DISPLAY_FIXTURES)).toBe(
      "ASUSTek COMPUTER INC XG27UCDMG",
    );
    expect(displayForMeasure({ width: 1920, height: 1080, density: 1 }, DISPLAY_FIXTURES)).toBe(
      "Samsung Electric Company Odyssey G40B",
    );
    expect(displayForMeasure({ width: 1152, height: 2048, density: 1.25 }, DISPLAY_FIXTURES)).toBe(
      "Dell Inc. DELL S2721DGF",
    );
  });

  it("ne force rien quand deux écrans sont indiscernables", () => {
    const twins = [
      { label: "Écran gauche", width: 1920, height: 1080, density: 1 },
      { label: "Écran droit", width: 1920, height: 1080, density: 1 },
    ];
    expect(displayForMeasure({ width: 1920, height: 1080, density: 1 }, twins)).toBeNull();
  });

  it("rend null quand aucun écran ne correspond", () => {
    expect(displayForMeasure({ width: 800, height: 600, density: 1 }, DISPLAY_FIXTURES)).toBeNull();
    expect(displayForMeasure({ width: 1920, height: 1080, density: 1.5 }, DISPLAY_FIXTURES)).toBeNull();
  });

  it("tolère l'imprécision d'une densité fractionnaire", () => {
    // `devicePixelRatio` traverse le pont IPC en flottant : 1.25 peut revenir
    // en 1.2500000001. Une égalité stricte manquerait l'écran.
    expect(displayForMeasure({ width: 1152, height: 2048, density: 1.2500000001 }, DISPLAY_FIXTURES)).toBe(
      "Dell Inc. DELL S2721DGF",
    );
  });
});
