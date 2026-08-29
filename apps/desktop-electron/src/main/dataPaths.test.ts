import { describe, expect, it } from "vitest";
import { dataFolder, dataRoot } from "./dataPaths";

const base = {
  appData: "/Users/k/Library/Application Support",
  home: "/home/k",
  env: {} as Record<string, string | undefined>,
};

describe("racineDonnees", () => {
  it("suit appData sur macOS et Windows", () => {
    expect(dataRoot({ ...base, platform: "darwin" })).toBe(base.appData);
    expect(dataRoot({ ...base, platform: "win32", appData: "C:\\Users\\k\\AppData\\Roaming" }))
      .toBe("C:\\Users\\k\\AppData\\Roaming");
  });

  it("sur Linux, prend le dossier XDG de DONNÉES, pas celui de configuration", () => {
    // Le piège : `appData` d'Electron vaut ~/.config sur Linux, alors que Tauri
    // écrivait dans ~/.local/share. Suivre `appData` perdrait les téléchargements.
    expect(dataRoot({ ...base, platform: "linux", appData: "/home/k/.config" }))
      .toBe("/home/k/.local/share");
  });

  it("respecte XDG_DATA_HOME quand il est absolu", () => {
    expect(dataRoot({ ...base, platform: "linux", env: { XDG_DATA_HOME: "/data/xdg" } }))
      .toBe("/data/xdg");
  });

  it("ignore un XDG_DATA_HOME vide ou relatif", () => {
    for (const xdg of ["", "  ", "relatif/xdg", "./xdg"]) {
      expect(dataRoot({ ...base, platform: "linux", env: { XDG_DATA_HOME: xdg } }))
        .toBe("/home/k/.local/share");
    }
  });

  it("nomme le dossier avec l'identifiant Tauri", () => {
    expect(dataFolder({ ...base, platform: "linux" }))
      .toBe("/home/k/.local/share/com.tentacle.media");
  });
});
