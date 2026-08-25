import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { connecteurPourLibelle, ecransConnectes, nomEdid } from "./ecrans";

/** Un EDID minimal portant un nom de moniteur dans le descripteur 0xFC. */
function edid(nom: string): Buffer {
  const b = Buffer.alloc(128);
  b[54 + 3] = 0xfc;
  b.write(`${nom}\n`, 54 + 5, "ascii");
  return b;
}

describe("nomEdid", () => {
  it("lit le nom du moniteur", () => {
    expect(nomEdid(edid("DELL S2721DGF"))).toBe("DELL S2721DGF");
  });

  it("rend null sur un EDID tronqué ou sans descripteur de nom", () => {
    expect(nomEdid(Buffer.alloc(64))).toBeNull();
    expect(nomEdid(Buffer.alloc(128))).toBeNull();
  });
});

describe("ecransConnectes", () => {
  it("ne retient que les connecteurs branchés, et en tire le nom court", () => {
    const racine = mkdtempSync(path.join(tmpdir(), "drm-"));
    for (const [dossier, statut, nom] of [
      ["card2-DP-3", "connected", "DELL S2721DGF"],
      ["card2-DP-4", "connected", "XG27UCDMG"],
      ["card2-HDMI-A-1", "disconnected", "TV SALON"],
    ] as const) {
      mkdirSync(path.join(racine, dossier));
      writeFileSync(path.join(racine, dossier, "status"), `${statut}\n`);
      writeFileSync(path.join(racine, dossier, "edid"), edid(nom));
    }
    // `version` et `card2` traînent dans ce dossier : ils ne sont pas des écrans.
    mkdirSync(path.join(racine, "card2"));
    writeFileSync(path.join(racine, "version"), "drm 1.1.0\n");

    expect(ecransConnectes(racine)).toEqual([
      { connecteur: "DP-3", nom: "DELL S2721DGF" },
      { connecteur: "DP-4", nom: "XG27UCDMG" },
    ]);
  });

  it("ne lève jamais, même sans /sys", () => {
    expect(ecransConnectes("/inexistant/xyz")).toEqual([]);
  });
});

describe("connecteurPourLibelle", () => {
  const ecrans = [
    { connecteur: "DP-2", nom: "Odyssey G40B" },
    { connecteur: "DP-3", nom: "DELL S2721DGF" },
    { connecteur: "DP-4", nom: "XG27UCDMG" },
  ];

  it("rapproche les libellés réels d'Electron de leur connecteur", () => {
    // Relevés tels quels sur le poste de mesure.
    expect(connecteurPourLibelle("Dell Inc. DELL S2721DGF", ecrans)).toBe("DP-3");
    expect(connecteurPourLibelle("ASUSTek COMPUTER INC XG27UCDMG", ecrans)).toBe("DP-4");
    expect(connecteurPourLibelle("Samsung Electric Company Odyssey G40B", ecrans)).toBe("DP-2");
  });

  it("ignore la casse, les espaces et la ponctuation", () => {
    expect(connecteurPourLibelle("dell inc.  dell-s2721dgf", ecrans)).toBe("DP-3");
  });

  it("préfère le nom le plus long quand deux se ressemblent", () => {
    const gamme = [
      { connecteur: "DP-1", nom: "XG27" },
      { connecteur: "DP-4", nom: "XG27UCDMG" },
    ];
    expect(connecteurPourLibelle("ASUSTek XG27UCDMG", gamme)).toBe("DP-4");
  });

  it("rend null plutôt qu'un mauvais écran quand rien ne correspond", () => {
    expect(connecteurPourLibelle("Écran inconnu", ecrans)).toBeNull();
    expect(connecteurPourLibelle("", ecrans)).toBeNull();
  });
});
