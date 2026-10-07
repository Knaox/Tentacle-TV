import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { placeLicenses } from "./macosLicenses.mjs";

/**
 * Le Mac App Store perdait la licence d'Electron et les avis de Chromium,
 * posés à côté du `.app` : ils entrent désormais dans le paquet, avec ceux de
 * Tentacle TV — et l'absence de l'un d'eux arrête l'emballage.
 */
let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function scene(withChromium = true) {
  dir = mkdtempSync(path.join(tmpdir(), "macos-licenses-"));
  const packaged = path.join(dir, "out");
  const app = path.join(packaged, "Tentacle TV.app");
  mkdirSync(path.join(app, "Contents", "Resources"), { recursive: true });
  writeFileSync(path.join(packaged, "LICENSE"), "electron");
  if (withChromium) writeFileSync(path.join(packaged, "LICENSES.chromium.html"), "<html/>");
  writeFileSync(path.join(dir, "LICENSE"), "agpl");
  writeFileSync(path.join(dir, "LICENSE-EXCEPTIONS"), "exceptions");
  writeFileSync(path.join(dir, "THIRD-PARTY-LICENSES.md"), "tiers");
  mkdirSync(path.join(dir, "dist"));
  return { app, packaged, dirs: { root: dir, appDir: dir, dist: path.join(dir, "dist") } };
}

describe("placeLicenses", () => {
  it("pose les cinq fichiers dans Contents/Resources/licenses", () => {
    const { app, packaged, dirs } = scene();
    const target = placeLicenses(app, packaged, dirs);
    expect(readdirSync(target).sort()).toEqual([
      "LICENSE-EXCEPTIONS.txt", "LICENSE.electron.txt", "LICENSE.tentacle-tv.txt",
      "LICENSES.chromium.html", "THIRD-PARTY-LICENSES.md",
    ]);
  });

  it("refuse d'emballer sans les avis de Chromium, ni à côté du .app ni dans Electron", () => {
    const { app, packaged, dirs } = scene(false);
    expect(() => placeLicenses(app, packaged, dirs)).toThrow(/LICENSES\.chromium\.html/);
  });

  it("reprend ceux du paquet d'Electron quand packager ne les a pas posés (universel)", () => {
    const { app, packaged, dirs } = scene(false);
    writeFileSync(path.join(dirs.dist, "LICENSES.chromium.html"), "<html/>");
    expect(readdirSync(placeLicenses(app, packaged, dirs))).toContain("LICENSES.chromium.html");
  });

  it("le paquet npm d'Electron porte bien les deux fichiers", async () => {
    const { electronDist } = await import("./macosLicenses.mjs");
    expect(readdirSync(electronDist())).toEqual(expect.arrayContaining(["LICENSE", "LICENSES.chromium.html"]));
  });
});
