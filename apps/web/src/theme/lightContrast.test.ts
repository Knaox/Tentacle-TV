/**
 * Le thème CLAIR se lit : toute encre qui porte du texte tient 4,5:1 sur le papier où elle se
 * pose. Les valeurs sont LUES dans `tokens.css` — un jeton qui s'éclaircit casse ce banc avant
 * l'écran. Mesuré d'abord sur l'instance réelle (`bench/clair-verre/audit.mjs`, nov. 2026 : la
 * tertiaire à 4,0:1 sur une carte, la quaternaire à 2,5:1) ; ce test en garde le résultat.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { compositeOver, contrastRatio, parseColor, WCAG_AA_LARGE, WCAG_AA_TEXT, type Rgba } from "./glass/contrast";

const TOKENS = readFileSync(join(__dirname, "tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const LIGHT = TOKENS.slice(TOKENS.indexOf(':root[data-theme="light"] {'));

function token(name: string): Rgba {
  const raw = new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m").exec(LIGHT)?.[1]?.trim();
  if (!raw) throw new Error(`jeton clair introuvable : ${name}`);
  const color = parseColor(raw.replace(/var\(--accent-rgb\)/, "162, 28, 175"));
  if (!color) throw new Error(`couleur illisible pour ${name} : ${raw}`);
  return color;
}

/** Le contraste d'une encre (translucide ou non) sur une pile de fonds, du bas vers le haut. */
function on(ink: Rgba, ...stack: Rgba[]): number {
  const surface = stack.reduce((under, layer) => compositeOver(layer, under));
  return contrastRatio(compositeOver(ink, surface), surface);
}

const surface = (n: number): Rgba => token(`--surface-${n}`);
const PAPERS = [0, 1, 2, 3] as const;

describe("les encres du thème clair", () => {
  for (const ink of ["--text-primary", "--text-secondary", "--text-tertiary", "--text-quaternary"]) {
    it(`${ink} : ≥ 4,5:1 sur la page, un panneau, une carte et un survol`, () => {
      for (const n of PAPERS) expect(on(token(ink), surface(n)), `sur --surface-${n}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it("même la plus faible tient sur une sélection (`--surface-4`)", () => {
    expect(on(token("--text-quaternary"), surface(4))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("et sur un remplissage translucide posé sur une carte (un champ, une touche de clavier)", () => {
    for (const fill of ["--fill-soft", "--fill-medium"]) {
      expect(on(token("--text-tertiary"), surface(2), token(fill)), fill).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
  });

  it("la hiérarchie reste ordonnée : chaque encre est plus sombre que la suivante", () => {
    const [p, s, t, q, d] = ["--text-primary", "--text-secondary", "--text-tertiary", "--text-quaternary", "--text-disabled"].map((n) => on(token(n), surface(1)));
    expect(p).toBeGreaterThan(s);
    expect(s).toBeGreaterThan(t);
    expect(t).toBeGreaterThan(q);
    expect(q).toBeGreaterThan(d);
  });

  it("un contrôle inactif reste repérable (≥ 2:1) sans prétendre se lire", () => {
    const ratio = on(token("--text-disabled"), surface(1));
    expect(ratio).toBeGreaterThanOrEqual(2);
    expect(ratio).toBeLessThan(WCAG_AA_TEXT);
  });
});

describe("la teinte franche et les états, sur le papier", () => {
  it("`--accent` en texte : ≥ 4,5:1 jusqu'au survol, et sur son propre fond doux", () => {
    for (const n of PAPERS) expect(on(token("--accent"), surface(n)), `sur --surface-${n}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    for (const n of [0, 1, 2] as const) expect(on(token("--accent"), surface(n), token("--accent-soft"))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("`--on-accent` sur un aplat d'accent : ≥ 4,5:1", () => {
    expect(on(token("--on-accent"), token("--accent"))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  for (const status of ["success", "warning", "error", "info"]) {
    it(`l'état « ${status} » : son encre ≥ 4,5:1 sur son fond, posé sur la page, un panneau ou une carte`, () => {
      for (const n of [0, 1, 2] as const) {
        expect(on(token(`--status-${status}-fg`), surface(n), token(`--status-${status}-bg`)), `sur --surface-${n}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      }
    });
    it(`l'état « ${status} » : sa couleur nue ≥ 4,5:1 en texte sur la page, un panneau ou une carte`, () => {
      for (const n of [0, 1, 2] as const) expect(on(token(`--status-${status}`), surface(n)), `sur --surface-${n}`).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }

  it("le bouton principal neutre et sa version secondaire", () => {
    expect(on(token("--cta-primary-fg"), token("--cta-primary-bg"))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    for (const n of PAPERS) expect(on(token("--cta-secondary-fg"), surface(n), token("--cta-secondary-bg-hover"))).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("un séparateur n'est pas un texte : il reste discret, mais se voit (≥ 1,15:1 pour le fort)", () => {
    expect(on(token("--border-strong"), surface(1))).toBeGreaterThanOrEqual(1.15);
    expect(on(token("--border-strong"), surface(1))).toBeLessThan(WCAG_AA_LARGE);
  });
});
