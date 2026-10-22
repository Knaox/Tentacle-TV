import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEB_DEPENDS, LIBMPV_SYSTEM_SONAMES, PACMAN_DEPENDS, RPM_DEPENDS } from "./packageDependencies.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe("dépendances déclarées des paquets Linux", () => {
  it("le rpm ne nomme aucun paquet propre à Fedora pour Vulkan (openSUSE le refusait)", () => {
    expect(RPM_DEPENDS).not.toContain("vulkan-loader");
    expect(RPM_DEPENDS).toContain("libvulkan.so.1()(64bit)");
  });

  it("le rpm déclare chaque SONAME système de la libmpv", () => {
    for (const soname of LIBMPV_SYSTEM_SONAMES) expect(RPM_DEPENDS).toContain(`${soname}()(64bit)`);
  });

  it("le .deb et le paquet Arch ont un paquet par SONAME système de la libmpv", () => {
    // Les derniers du .deb suivent l'ordre de LIBMPV_SYSTEM_SONAMES.
    expect(DEB_DEPENDS.slice(-LIBMPV_SYSTEM_SONAMES.length)).toEqual(
      ["libvulkan1", "libgbm1", "libegl1", "libgomp1", "libpulse0"],
    );
    for (const name of ["libpulse", "mesa", "libglvnd", "gcc-libs"]) {
      expect(PACMAN_DEPENDS).toContain(name);
    }
  });

  const script = readFileSync(path.join(HERE, "../build-mpv-linux.sh"), "utf8");
  const whitelist = script.match(/^UNIVERSELS="([^"]*)"/m)?.[1] ?? "";

  it("chaque SONAME déclaré est bien dans la liste blanche de build-mpv-linux.sh", () => {
    for (const soname of LIBMPV_SYSTEM_SONAMES) expect(whitelist).toContain(` ${soname} `);
  });

  it("libXpresent et libXss voyagent avec la chaîne, hors de la liste blanche", () => {
    // Absentes d'un Fedora GNOME / KDE de série : l'AppImage ne peut pas les déclarer.
    for (const soname of ["libXpresent.so.1", "libXss.so.1"]) {
      expect(whitelist).not.toContain(` ${soname} `);
      expect(RPM_DEPENDS).not.toContain(`${soname}()(64bit)`);
    }
    expect(script).toMatch(/^EMBARQUEES='\^\(libXpresent\|libXss\)\\\.so'$/m);
  });
});
