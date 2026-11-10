/**
 * Le CONTRAT du socle de la refonte (nov. 2026, docs/REFONTE-UI.md) : ce que les six axes
 * d'écrans tiennent pour acquis. Une valeur validée sur le prototype qui bouge ici bouge
 * partout — ce banc le dit avant l'écran.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { duration, easeDrawer, easeInOut, easeOut, pageTransition } from "./motion";

const THEME = __dirname;
const SRC = join(THEME, "..");
const read = (name: string): string => readFileSync(join(THEME, name), "utf8");
const TOKENS = read("tokens.css");
const DARK = TOKENS.slice(0, TOKENS.indexOf(':root[data-theme="light"] {'));
const LIGHT = TOKENS.slice(TOKENS.indexOf(':root[data-theme="light"] {'));

const token = (block: string, name: string): string | undefined =>
  new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m").exec(block)?.[1]?.trim();

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

function sources(extensions: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (extensions.includes(extname(full)) && !full.endsWith("socle.test.ts")) out.push(full);
    }
  };
  walk(SRC);
  return out;
}

describe("les jetons de la refonte", () => {
  it("cinq encres neutres en sombre — ni noir pur, ni bleu nuit", () => {
    expect(["--surface-0", "--surface-1", "--surface-2", "--surface-3", "--surface-4"].map((n) => token(DARK, n))).toEqual([
      "#0B0B0C", "#131315", "#1B1B1E", "#242428", "#303036",
    ]);
    expect(token(DARK, "--text-primary")).toBe("#F4F2EE");
  });

  it("le clair redéclare les cinq encres et l'accent", () => {
    for (const name of ["--surface-0", "--surface-1", "--surface-2", "--surface-3", "--surface-4", "--accent", "--accent-rgb", "--on-accent"]) {
      expect(token(LIGHT, name), name).toBeDefined();
    }
  });

  it("l'accent : la teinte franche, le dégradé du logo pour lire et pour mesurer — jamais d'orange", () => {
    expect(token(DARK, "--accent")).toBe("#E58CF0");
    expect(token(DARK, "--cta-brand-gradient")).toBe("linear-gradient(120deg, var(--brand-dark) 0%, var(--brand-accent-dark) 100%)");
    expect(token(DARK, "--gauge-gradient")).toBe("linear-gradient(90deg, var(--brand) 0%, var(--brand-accent) 100%)");
    expect(token(DARK, "--brand")).toBe("#8B5CF6");
    expect(token(DARK, "--brand-accent")).toBe("#EC4899");
  });

  it("cinq rayons et la pilule", () => {
    expect(["--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--radius-2xl", "--radius-3xl"].map((n) => token(DARK, n))).toEqual([
      "6px", "10px", "12px", "16px", "20px", "24px",
    ]);
  });

  it("les courbes et les durées du brief, dans la feuille et pour framer", () => {
    expect(token(DARK, "--ease-out")).toBe("cubic-bezier(0.23, 1, 0.32, 1)");
    expect(token(DARK, "--ease-in-out")).toBe("cubic-bezier(0.77, 0, 0.175, 1)");
    expect(token(DARK, "--ease-drawer")).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
    expect([easeOut, easeInOut, easeDrawer]).toEqual([[0.23, 1, 0.32, 1], [0.77, 0, 0.175, 1], [0.32, 0.72, 0, 1]]);
    const ms = (name: string): number => Number.parseInt(token(DARK, name) ?? "", 10);
    expect({
      press: ms("--duration-press"), hover: ms("--duration-hover"), menuIn: ms("--duration-menu-in"), menuOut: ms("--duration-menu-out"),
      card: ms("--duration-card"), sheetIn: ms("--duration-sheet-in"), sheetOut: ms("--duration-sheet-out"),
    }).toEqual({ press: 120, hover: 160, menuIn: 180, menuOut: 120, card: 220, sheetIn: 320, sheetOut: 200 });
    // Les deux échelles disent la même chose.
    expect(duration.press * 1000).toBe(ms("--duration-press"));
    expect(duration.menuIn * 1000).toBe(ms("--duration-menu-in"));
    expect(duration.sheetIn * 1000).toBe(ms("--duration-sheet-in"));
    expect(token(DARK, "--press-scale")).toBe("0.97");
    expect(token(DARK, "--card-hover-scale")).toBe("1.03");
  });

  it("un changement de page est un fondu seul, de 120 à 160 ms", () => {
    expect(Object.keys(pageTransition.initial)).toEqual(["opacity"]);
    expect(Object.keys(pageTransition.exit).sort()).toEqual(["opacity", "transition"]);
    for (const seconds of [pageTransition.animate.transition.duration, pageTransition.exit.transition.duration]) {
      expect(seconds).toBeGreaterThanOrEqual(0.12);
      expect(seconds).toBeLessThanOrEqual(0.16);
    }
  });

  it("mouvement réduit : les durées par rôle à zéro, plus d'échelle", () => {
    const reduce = read("motion-reduce.css");
    for (const name of ["--duration-press", "--duration-hover", "--duration-menu-in", "--duration-card", "--duration-sheet-in"]) {
      expect(reduce, name).toMatch(new RegExp(`${name}: 0ms;`));
    }
    expect(reduce).toMatch(/--press-scale: 1;/);
    expect(reduce).toMatch(/--card-hover-scale: 1;/);
  });
});

describe("les boutons du socle", () => {
  const BUTTONS = withoutComments(read("buttons.css"));

  it("des pilules, trois tailles, la pression dès l'appui", () => {
    expect(BUTTONS).toMatch(/\.btn,\s*\.icon-btn \{[^}]*border-radius: var\(--radius-pill\);/);
    expect([/\.btn \{[^}]*height: 40px;/, /\.btn\.btn-sm \{[^}]*height: 32px;/, /\.btn\.btn-lg \{[^}]*height: 52px;/].every((r) => r.test(BUTTONS))).toBe(true);
    expect(BUTTONS).toMatch(/\.btn:active,\s*\.icon-btn:active \{\s*transform: scale\(var\(--press-scale\)\);/);
    expect(BUTTONS).toMatch(/transform var\(--duration-press\) var\(--ease-out\)/);
  });

  it("l'action de lecture porte le dégradé du logo, et elle seule", () => {
    expect(BUTTONS).toMatch(/\.btn-play \{\s*background-image: var\(--cta-brand-gradient\);/);
    expect(BUTTONS.match(/gradient/g)?.length).toBe(2); // .btn-play et la jauge
  });

  it.each(["buttons.css", "overlays.css", "controls.css", "seasonTabs.css", "heroCta.css"])("%s : un survol ne vaut qu'à la souris", (file) => {
    const css = withoutComments(read(file));
    const outside = css.replace(/@media \(hover: hover\) and \(pointer: fine\) \{(?:[^{}]|\{[^{}]*\})*\}/g, "");
    // Le curseur de réglage garde son survol de pouce (pseudo-élément, sans équivalent tactile gênant).
    expect(outside.replace(/\.ctl-range:hover[^{]*\{[^}]*\}/g, "")).not.toMatch(/:hover/);
  });
});

describe("ce que le socle interdit", () => {
  it("ni `transition: all` ni `transition-all` dans le code", () => {
    const offenders = sources([".ts", ".tsx", ".css"]).filter((file) => /transition-all\b|transition:\s*all\b/.test(withoutComments(readFileSync(file, "utf8"))));
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it("aucune courbe d'accélération (`ease-in`) dans le thème ni dans theme/motion.ts", () => {
    for (const file of readdirSync(THEME).filter((f) => f.endsWith(".css"))) {
      expect(withoutComments(read(file)), file).not.toMatch(/ease-in(?!-out)\b/);
    }
    expect(read("motion.ts").replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/easeIn\b(?!Out)/);
  });

  it("plus de dégradé de marque décoratif dans les contrôles du thème", () => {
    for (const file of ["controls.css", "seasonTabs.css", "chrome.css"]) {
      const css = withoutComments(read(file));
      expect(css, file).not.toMatch(/gradient\([^)]*var\(--brand(?!-rgb)/);
      expect(css, file).not.toMatch(/gradient\([^)]*rgba\(var\(--brand/);
    }
  });

  it("les polices sont embarquées — aucune adresse distante", () => {
    expect(read("fonts.css")).not.toMatch(/https?:\/\//);
    expect(read("fonts.css")).toMatch(/Bricolage Grotesque Variable/);
    expect(read("fonts.css")).toMatch(/Figtree Variable/);
    // La page ne demande aucune feuille ni police au réseau (sa CSP en tolère pour les extensions).
    expect(readFileSync(join(SRC, "..", "index.html"), "utf8")).not.toMatch(/<link[^>]+fonts\.(googleapis|gstatic)/);
  });
});
