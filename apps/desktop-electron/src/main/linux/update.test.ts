import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import { detectFormat, nameFrom, owns, type OwnershipProbe } from "./update";

beforeEach(() => { delete process.env["APPIMAGE"]; });
afterEach(() => { delete process.env["APPIMAGE"]; });

describe("nomSur", () => {
  it("refuse qu'un nom venu du réseau désigne un chemin", () => {
    expect(nameFrom("../../.bashrc")).not.toContain("/");
    expect(nameFrom("a/b/c.deb")).toBe("a_b_c.deb");
    expect(nameFrom("dossier\\paquet.rpm")).toBe("dossier_paquet.rpm");
  });

  it("refuse un nom qui commence par un point", () => {
    // `.bashrc` seul ne remonte nulle part, mais reste un fichier caché posé
    // dans un dossier qu'on nettoie : autant ne jamais le produire.
    expect(nameFrom("..")).toBe("_");
    expect(nameFrom(".cache")).toBe("_cache");
  });

  it("laisse un nom ordinaire intact", () => {
    expect(nameFrom("Tentacle.TV_1.21.0_amd64.deb")).toBe("Tentacle.TV_1.21.0_amd64.deb");
  });

  it("ne rend jamais une chaîne vide", () => {
    expect(nameFrom("")).toBe("paquet");
    expect(path.join("/tmp", nameFrom(""))).toBe("/tmp/paquet");
  });
});

describe("detecterFormat", () => {
  // Aucun gestionnaire de paquets RÉEL n'est interrogé : sur le runner Ubuntu
  // de la CI, `dpkg -S` parcourait toute la base des paquets et dépassait les
  // 5 s du test ; sur macOS, les commandes n'existent même pas. La sonde est
  // injectée — sa vraie version est éprouvée plus bas, sur Node lui-même.
  const asked: string[] = [];
  const ownedBy = (owner: string | null): OwnershipProbe => async (command) => {
    asked.push(command);
    return command === owner;
  };
  beforeEach(() => { asked.length = 0; });

  it("reconnaît une AppImage AVANT tout gestionnaire de paquets", async () => {
    // L'ordre compte : une AppImage lancée sur une machine où le paquet est
    // aussi installé se ferait sinon prendre pour lui, et la mise à jour
    // remplacerait le mauvais fichier.
    process.env["APPIMAGE"] = "/home/k/Applications/TentacleTV.AppImage";
    expect(await detectFormat(ownedBy("dpkg"))).toBe("appimage");
    expect(asked).toEqual([]);
  });

  it("ignore un $APPIMAGE vide", async () => {
    process.env["APPIMAGE"] = "";
    expect(await detectFormat(ownedBy(null))).toBe("unknown");
    expect(asked).toEqual(["pacman", "dpkg", "rpm"]);
  });

  it("rend le gestionnaire qui possède le binaire, dans l'ordre pacman, dpkg, rpm", async () => {
    expect(await detectFormat(ownedBy("pacman"))).toBe("pacman");
    expect(await detectFormat(ownedBy("dpkg"))).toBe("deb");
    expect(await detectFormat(ownedBy("rpm"))).toBe("rpm");
  });
});

describe("la sonde d'un gestionnaire de paquets", () => {
  it("vraie si la commande réussit ; fausse si elle échoue ou n'existe pas", async () => {
    expect(await owns(process.execPath, ["-e", "process.exit(0)"])).toBe(true);
    expect(await owns(process.execPath, ["-e", "process.exit(3)"])).toBe(false);
    expect(await owns("tentacle-commande-introuvable", [])).toBe(false);
  });
});
