import { describe, expect, it } from "vitest";
import { parseOtoolLibraries, sliceProblems } from "./macosDylibs.mjs";

/**
 * Le 1.30.0 (1468281) partait sans `libbrotlicommon.1.dylib` : sa voisine la
 * désignait par `@rpath`, que le collecteur ne suivait pas. Le contrôle refuse
 * désormais tout ce qui ne se résout pas DANS le jeu livré.
 */
const BROTLIDEC = `/x/libbrotlidec.1.dylib:
\t@loader_path/libbrotlidec.1.dylib (compatibility version 1.0.0, current version 1.2.0)
\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1356.0.0)
\t@rpath/libbrotlicommon.1.dylib (compatibility version 1.0.0, current version 1.2.0)
`;

function slice(libraries, present = {}) {
  return sliceProblems({
    name: "libx.dylib",
    arch: "arm64",
    id: "@loader_path/libx.dylib",
    libraries,
    has: (target, arch) => target in present && (arch === null || present[target].includes(arch)),
  });
}

describe("parseOtoolLibraries", () => {
  it("rend les noms d'installation, sans l'en-tête ni les versions", () => {
    expect(parseOtoolLibraries(BROTLIDEC)).toEqual([
      "@loader_path/libbrotlidec.1.dylib",
      "/usr/lib/libSystem.B.dylib",
      "@rpath/libbrotlicommon.1.dylib",
    ]);
  });

  it("garde un chemin qui contient des espaces", () => {
    const text = "/a b/libx.dylib:\n\t/Applications/Tentacle TV.app/libx.dylib (compatibility version 1.0.0, current version 1.0.0)\n";
    expect(parseOtoolLibraries(text)).toEqual(["/Applications/Tentacle TV.app/libx.dylib"]);
  });
});

describe("sliceProblems", () => {
  it("refuse une dépendance en @rpath (le cas du 1.30.0)", () => {
    const problems = slice(["@rpath/libbrotlicommon.1.dylib"], { "libbrotlicommon.1.dylib": ["arm64"] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("@rpath/libbrotlicommon.1.dylib");
  });

  it("refuse un chemin absolu hors système (Homebrew, préfixe de build)", () => {
    expect(slice(["/opt/homebrew/opt/libpng/lib/libpng16.16.dylib"])).toHaveLength(1);
    expect(slice(["@executable_path/../Frameworks/liby.dylib"])).toHaveLength(1);
  });

  it("refuse une voisine absente du jeu", () => {
    expect(slice(["@loader_path/libabsente.dylib"])[0]).toContain("absente du jeu");
  });

  it("refuse une voisine qui ne porte pas l'architecture de la tranche", () => {
    const problems = slice(["@loader_path/libunibreak.7.dylib"], { "libunibreak.7.dylib": ["x86_64"] });
    expect(problems[0]).toContain("architecture arm64");
  });

  it("accepte le système, son propre nom et une voisine présente", () => {
    const libraries = [
      "@loader_path/libx.dylib",
      "/usr/lib/libSystem.B.dylib",
      "/System/Library/Frameworks/CoreText.framework/Versions/A/CoreText",
      "@loader_path/libpng16.16.dylib",
    ];
    expect(slice(libraries, { "libpng16.16.dylib": ["arm64", "x86_64"] })).toEqual([]);
  });
});
