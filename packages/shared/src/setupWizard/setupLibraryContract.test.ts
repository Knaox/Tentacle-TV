import { describe, expect, it } from "vitest";
import { isWindowsPath, pathStyleOf } from "./setupLibraryContract";

describe("la forme des chemins de la machine de Jellyfin", () => {
  it("lecteurs et partages Windows", () => {
    for (const path of ["C:\\", "D:/Films", "e:", "\\\\nas\\films"]) expect(isWindowsPath(path)).toBe(true);
    for (const path of ["/", "/media/films", "media", "C", "//nas"]) expect(isWindowsPath(path)).toBe(false);
  });

  it("un seul chemin Windows suffit ; sinon Linux, macOS ou un conteneur", () => {
    expect(pathStyleOf(["C:\\", "D:\\"])).toBe("windows");
    expect(pathStyleOf(["/", "/media"])).toBe("posix");
    expect(pathStyleOf([])).toBe("posix");
  });
});
