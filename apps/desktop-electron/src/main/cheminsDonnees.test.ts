import { describe, expect, it } from "vitest";
import { dossierDonnees, racineDonnees } from "./cheminsDonnees";

const base = {
  appData: "/Users/k/Library/Application Support",
  home: "/home/k",
  env: {} as Record<string, string | undefined>,
};

describe("racineDonnees", () => {
  it("suit appData sur macOS et Windows", () => {
    expect(racineDonnees({ ...base, plateforme: "darwin" })).toBe(base.appData);
    expect(racineDonnees({ ...base, plateforme: "win32", appData: "C:\\Users\\k\\AppData\\Roaming" }))
      .toBe("C:\\Users\\k\\AppData\\Roaming");
  });

  it("sur Linux, prend le dossier XDG de DONNÉES, pas celui de configuration", () => {
    // Le piège : `appData` d'Electron vaut ~/.config sur Linux, alors que Tauri
    // écrivait dans ~/.local/share. Suivre `appData` perdrait les téléchargements.
    expect(racineDonnees({ ...base, plateforme: "linux", appData: "/home/k/.config" }))
      .toBe("/home/k/.local/share");
  });

  it("respecte XDG_DATA_HOME quand il est absolu", () => {
    expect(racineDonnees({ ...base, plateforme: "linux", env: { XDG_DATA_HOME: "/data/xdg" } }))
      .toBe("/data/xdg");
  });

  it("ignore un XDG_DATA_HOME vide ou relatif", () => {
    for (const xdg of ["", "  ", "relatif/xdg", "./xdg"]) {
      expect(racineDonnees({ ...base, plateforme: "linux", env: { XDG_DATA_HOME: xdg } }))
        .toBe("/home/k/.local/share");
    }
  });

  it("nomme le dossier avec l'identifiant Tauri", () => {
    expect(dossierDonnees({ ...base, plateforme: "linux" }))
      .toBe("/home/k/.local/share/com.tentacle.media");
  });
});
