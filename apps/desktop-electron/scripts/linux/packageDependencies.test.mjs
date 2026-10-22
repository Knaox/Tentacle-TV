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
    // Les sept derniers du .deb suivent l'ordre de LIBMPV_SYSTEM_SONAMES.
    expect(DEB_DEPENDS.slice(-LIBMPV_SYSTEM_SONAMES.length)).toEqual(
      ["libvulkan1", "libgbm1", "libegl1", "libxpresent1", "libxss1", "libgomp1", "libpulse0"],
    );
    for (const name of ["libxpresent", "libxss", "libpulse", "mesa", "libglvnd", "gcc-libs"]) {
      expect(PACMAN_DEPENDS).toContain(name);
    }
  });

  it("chaque SONAME déclaré est bien dans la liste blanche de build-mpv-linux.sh", () => {
    const script = readFileSync(path.join(HERE, "../build-mpv-linux.sh"), "utf8");
    const whitelist = script.match(/^UNIVERSELS="([^"]*)"/m)?.[1] ?? "";
    for (const soname of LIBMPV_SYSTEM_SONAMES) expect(whitelist).toContain(` ${soname} `);
  });
});
