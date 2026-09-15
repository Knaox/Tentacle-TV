import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { iconRefreshPlan, userIconRoot } from "./desktopIcons";

/**
 * Le rattrapage d'icônes, sur un faux `$HOME`. Ce qui se garde : il ne CRÉE
 * rien chez qui n'a pas intégré l'application, il ne recopie que ce qui a
 * changé, et une taille déjà posée entraîne toutes les autres.
 */

let home = "";
let appDir = "";

function poserAppImage(sizes: readonly string[], contenu: string): void {
  for (const size of sizes) {
    const folder = path.join(appDir, "usr", "share", "icons", "hicolor", size, "apps");
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, "tentacle-tv.png"), `${contenu}-${size}`);
  }
}

function poserBureau(sizes: readonly string[], contenu: string): void {
  for (const size of sizes) {
    const folder = path.join(userIconRoot(home), size, "apps");
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, "tentacle-tv.png"), `${contenu}-${size}`);
  }
}

beforeEach(() => {
  const base = mkdtempSync(path.join(tmpdir(), "tentacle-icones-"));
  home = path.join(base, "home");
  appDir = path.join(base, "appdir");
  mkdirSync(home, { recursive: true });
});

afterEach(() => {
  rmSync(path.dirname(home), { recursive: true, force: true });
});

describe("iconRefreshPlan", () => {
  it("ne propose RIEN quand l'application n'est pas intégrée au bureau", () => {
    poserAppImage(["32x32", "512x512"], "neuve");
    // Une AppImage n'installe rien : sans icône déjà posée, il n'y a pas
    // d'intégration à entretenir, et ce n'est pas à une mise à jour de la créer.
    expect(iconRefreshPlan(appDir, userIconRoot(home))).toEqual([]);
  });

  it("ne propose rien non plus hors AppImage — `$APPDIR` est vide", () => {
    poserBureau(["512x512"], "vieille");
    expect(iconRefreshPlan("", userIconRoot(home))).toEqual([]);
  });

  it("ne recopie que ce qui a CHANGÉ", () => {
    poserAppImage(["32x32", "512x512"], "neuve");
    poserBureau(["32x32"], "neuve");
    poserBureau(["512x512"], "vieille");
    const plan = iconRefreshPlan(appDir, userIconRoot(home));
    expect(plan).toHaveLength(1);
    expect(plan[0]?.to).toBe(path.join(userIconRoot(home), "512x512", "apps", "tentacle-tv.png"));
  });

  it("rend une liste vide quand tout est déjà à jour — le cas de chaque démarrage", () => {
    poserAppImage(["32x32", "512x512"], "neuve");
    poserBureau(["32x32", "512x512"], "neuve");
    expect(iconRefreshPlan(appDir, userIconRoot(home))).toEqual([]);
  });

  it("une seule taille posée entraîne toutes celles que l'AppImage porte", () => {
    poserAppImage(["32x32", "64x64", "128x128", "256x256", "512x512"], "neuve");
    // L'intégration faite à la main n'en pose souvent qu'une : la barre des
    // tâches réduit alors un 512 au lieu de lire le 32 qui lui est destiné.
    poserBureau(["512x512"], "vieille");
    expect(iconRefreshPlan(appDir, userIconRoot(home))).toHaveLength(5);
  });

  it("ignore une taille absente de l'AppImage", () => {
    poserAppImage(["512x512"], "neuve");
    poserBureau(["512x512"], "vieille");
    const plan = iconRefreshPlan(appDir, userIconRoot(home));
    expect(plan.map((c) => path.basename(path.dirname(path.dirname(c.to))))).toEqual(["512x512"]);
  });
});
