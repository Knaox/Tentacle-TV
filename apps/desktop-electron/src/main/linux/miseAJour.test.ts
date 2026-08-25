import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { detecterFormat, nomSur } from "./miseAJour";

afterEach(() => { delete process.env["APPIMAGE"]; });

describe("nomSur", () => {
  it("refuse qu'un nom venu du réseau désigne un chemin", () => {
    expect(nomSur("../../.bashrc")).not.toContain("/");
    expect(nomSur("a/b/c.deb")).toBe("a_b_c.deb");
    expect(nomSur("dossier\\paquet.rpm")).toBe("dossier_paquet.rpm");
  });

  it("refuse un nom qui commence par un point", () => {
    // `.bashrc` seul ne remonte nulle part, mais reste un fichier caché posé
    // dans un dossier qu'on nettoie : autant ne jamais le produire.
    expect(nomSur("..")).toBe("_");
    expect(nomSur(".cache")).toBe("_cache");
  });

  it("laisse un nom ordinaire intact", () => {
    expect(nomSur("Tentacle.TV_1.21.0_amd64.deb")).toBe("Tentacle.TV_1.21.0_amd64.deb");
  });

  it("ne rend jamais une chaîne vide", () => {
    expect(nomSur("")).toBe("paquet");
    expect(path.join("/tmp", nomSur(""))).toBe("/tmp/paquet");
  });
});

describe("detecterFormat", () => {
  it("reconnaît une AppImage AVANT tout gestionnaire de paquets", async () => {
    // L'ordre compte : une AppImage lancée sur une machine où le paquet est
    // aussi installé se ferait sinon prendre pour lui, et la mise à jour
    // remplacerait le mauvais fichier.
    process.env["APPIMAGE"] = "/home/k/Applications/TentacleTV.AppImage";
    expect(await detecterFormat()).toBe("appimage");
  });

  it("ignore un $APPIMAGE vide", async () => {
    process.env["APPIMAGE"] = "";
    expect(await detecterFormat()).not.toBe("appimage");
  });
});
