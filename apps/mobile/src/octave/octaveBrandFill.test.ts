import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lot « Octave mobile, deuxième passe » (o1) : l'action principale d'Octave —
 * « Lecture », l'appel d'une feuille — prend le dégradé ROSE de marque par un
 * seul chemin (`OctaveBrandFill` / `OctavePlayButton`), jamais le violet seul
 * de Tentacle (`cta.brandBg`) ; et la barre du téléphone ne porte plus le
 * retour aux films (il vit dans le hub du compte), la recherche y est à droite.
 */
const ROOT = __dirname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe("Octave mobile : le dégradé de marque, un seul chemin", () => {
  it("aucun écran d'Octave ne remplit un bouton du violet seul (`cta.brandBg`)", () => {
    const offenders = sources(ROOT).filter((path) => /colors\.cta\.brandBg\b/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("le remplissage de marque va du violet au rose, celui du bouton du lecteur", () => {
    const colors = readFileSync(join(ROOT, "theme/octaveColors.ts"), "utf8");
    expect(colors).toMatch(/brandFill: \[colors\.brand\.violet, colors\.brand\.accent\]/);
    const transport = readFileSync(join(ROOT, "player/TransportControls.tsx"), "utf8");
    expect(transport).toMatch(/colors\.gradient\[0\], colors\.gradient\[1\]/);
  });
});

describe("Octave mobile : la barre du téléphone, à la Apple Music", () => {
  const bar = readFileSync(join(ROOT, "shell/OctaveTabBar.tsx"), "utf8");
  const items = readFileSync(join(ROOT, "shell/octaveNavItems.ts"), "utf8");

  it("ne bascule plus vers Tentacle TV", () => {
    expect(bar).not.toMatch(/useLeaveOctave|backToFilms|Clapperboard/);
  });

  it("la pilule garde les destinations, la recherche est à part, à droite", () => {
    expect(items).toMatch(/OCTAVE_PILL_ITEMS[^=]*= OCTAVE_NAV_ITEMS\.filter\(\(item\) => item\.tab !== "search"\)/);
    expect(bar.indexOf("OCTAVE_PILL_ITEMS.map")).toBeGreaterThan(0);
    expect(bar.indexOf("OCTAVE_SEARCH_ITEM.tab)")).toBeGreaterThan(bar.indexOf("OCTAVE_PILL_ITEMS.map"));
  });
});

describe("Octave mobile : la bascule vers Tentacle TV, à gauche de l'avatar", () => {
  const topBar = readFileSync(join(ROOT, "layout/OctaveTopBar.tsx"), "utf8");
  const account = readFileSync(join(ROOT, "account/OctaveAccountScreen.tsx"), "utf8");

  it("en tête des pages racines, juste avant l'avatar", () => {
    const leave = topBar.indexOf("<OctaveLeaveButton />");
    expect(leave).toBeGreaterThan(0);
    expect(topBar.indexOf("<OctaveAccountButton />")).toBeGreaterThan(leave);
  });

  it("plus dans le hub « Compte »", () => {
    expect(account).not.toMatch(/useLeaveOctave\(|<OctaveLeaveButton|<LeaveOctavePill|import .*Leave/);
  });
});
