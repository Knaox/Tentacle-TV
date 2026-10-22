import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import { detectFormat, immutableRoot, installCommand, nameFrom, owns, type OwnershipProbe } from "./update";

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
  // Le poste de test peut être lui-même immuable (Bazzite) : la racine est
  // injectée, jamais lue sur la machine.
  const notImmutable = () => false;
  beforeEach(() => { asked.length = 0; });

  it("reconnaît une AppImage AVANT tout gestionnaire de paquets", async () => {
    // L'ordre compte : une AppImage lancée sur une machine où le paquet est
    // aussi installé se ferait sinon prendre pour lui, et la mise à jour
    // remplacerait le mauvais fichier.
    process.env["APPIMAGE"] = "/home/k/Applications/TentacleTV.AppImage";
    expect(await detectFormat(ownedBy("dpkg"), notImmutable)).toBe("appimage");
    expect(asked).toEqual([]);
  });

  it("ignore un $APPIMAGE vide", async () => {
    process.env["APPIMAGE"] = "";
    expect(await detectFormat(ownedBy(null), notImmutable)).toBe("unknown");
    expect(asked).toEqual(["pacman", "dpkg", "rpm"]);
  });

  it("rend le gestionnaire qui possède le binaire, dans l'ordre pacman, dpkg, rpm", async () => {
    expect(await detectFormat(ownedBy("pacman"), notImmutable)).toBe("pacman");
    expect(await detectFormat(ownedBy("dpkg"), notImmutable)).toBe("deb");
    expect(await detectFormat(ownedBy("rpm"), notImmutable)).toBe("rpm");
  });
});

describe("racine immuable", () => {
  it("ne propose rien pour un paquet superposé sur Fedora Atomic", async () => {
    // Bazzite : rpm possède bien le binaire, mais `dnf` refuse d'installer.
    const rpmOwns: OwnershipProbe = async (command) => command === "rpm";
    expect(await detectFormat(rpmOwns, () => true)).toBe("unknown");
  });

  it("garde l'AppImage, qui se remplace sans toucher au système", async () => {
    process.env["APPIMAGE"] = "/home/k/Applications/TentacleTV.AppImage";
    expect(await detectFormat(async () => true, () => true)).toBe("appimage");
  });

  it("reconnaît les témoins de install-linux.sh", () => {
    const none = () => false;
    expect(immutableRoot((p) => p === "/run/ostree-booted", none)).toBe(true);
    for (const binary of ["rpm-ostree", "transactional-update", "steamos-readonly"]) {
      expect(immutableRoot(none, (b) => b === binary)).toBe(true);
    }
    expect(immutableRoot(none, none)).toBe(false);
  });
});

describe("commande d'installation", () => {
  const only = (...binaries: string[]) => (b: string) => binaries.includes(b);

  it("installe un rpm par zypper sur openSUSE, qui n'a pas de dnf", () => {
    expect(installCommand("/tmp/t.rpm", "rpm", only("zypper", "rpm"))).toEqual(
      ["zypper", ["--non-interactive", "install", "--allow-unsigned-rpm", "/tmp/t.rpm"]],
    );
  });

  it("préfère dnf quand il est là (Fedora)", () => {
    expect(installCommand("/tmp/t.rpm", "rpm", only("dnf", "zypper"))).toEqual(
      ["dnf", ["install", "-y", "/tmp/t.rpm"]],
    );
  });

  it("refuse clairement sans gestionnaire rpm connu", () => {
    expect(() => installCommand("/tmp/t.rpm", "rpm", only())).toThrow(/ni dnf ni zypper/);
  });

  it("garde apt-get et pacman pour leurs formats", () => {
    expect(installCommand("/tmp/t.deb", "deb", only())[0]).toBe("apt-get");
    expect(installCommand("/tmp/t.pkg.tar.zst", "pacman", only())).toEqual(
      ["pacman", ["-U", "--noconfirm", "/tmp/t.pkg.tar.zst"]],
    );
  });
});

describe("la sonde d'un gestionnaire de paquets", () => {
  it("vraie si la commande réussit ; fausse si elle échoue ou n'existe pas", async () => {
    expect(await owns(process.execPath, ["-e", "process.exit(0)"])).toBe(true);
    expect(await owns(process.execPath, ["-e", "process.exit(3)"])).toBe(false);
    expect(await owns("tentacle-commande-introuvable", [])).toBe(false);
  });
});
