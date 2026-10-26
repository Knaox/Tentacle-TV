/**
 * Les pages de Tentacle au verre de la MAQUETTE (26/10) : la coquille
 * (`paneShell.css`) et le contenu (`paneContent.css`) — tenus sur les feuilles.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AMBIENT_DARK, AMBIENT_INK } from "./glass/paneMaterial";

const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");
const SHELL = strip(readFileSync(join(__dirname, "paneShell.css"), "utf8"));
const CONTENT = strip(readFileSync(join(__dirname, "paneContent.css"), "utf8"));
const TOKENS = strip(readFileSync(join(__dirname, "liquidGlassContent.css"), "utf8"));

/** Les sélecteurs d'une liste (virgules hors parenthèses). */
function splitTop(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += ch;
  }
  return [...out, current.trim()];
}

const rules = (source: string): Array<[string, string]> =>
  [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim(), body]);

type Rgb = [number, number, number];
const over = (top: Rgb, alpha: number, base: Rgb): Rgb =>
  [0, 1, 2].map((i) => top[i] * alpha + base[i] * (1 - alpha)) as Rgb;
const luminance = ([r, g, b]: Rgb): number => {
  const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("les pages au verre de la maquette", () => {
  it("chaque règle est portée par la porte native (rendu d'avant ailleurs)", () => {
    for (const [selector] of [...rules(SHELL), ...rules(CONTENT)]) {
      for (const part of splitTop(selector)) expect(part, part).toContain('[data-liquid-glass="native"]');
    }
  });

  it("l'encre de la page est celle sur laquelle le socle prouve le verre", () => {
    const ink = rules(SHELL).find(([s]) => s.includes(':not([data-theme="light"])'))![1];
    expect(ink).toMatch(/--surface-0:\s*#07050c/i);
    expect([AMBIENT_INK.r, AMBIENT_INK.g, AMBIENT_INK.b]).toEqual([7, 5, 12]);
  });

  it("le fond ambiant passe SOUS le contenu", () => {
    expect(rules(SHELL).find(([s]) => s.includes(".lg-ambient.lgc-ambient"))![1]).toMatch(/z-index:\s*-1/);
  });

  it("le texte secondaire et tertiaire tiennent 4,5:1 sur le voile, au pire croisement de deux taches", () => {
    const body = rules(CONTENT).find(([s]) => s.includes(":is(.lg-page, .lg-detail)"))![1];
    const tertiary = Number(/--text-tertiary:\s*rgba\(255, 255, 255, ([\d.]+)\)/.exec(body)![1]);
    const tokens = rules(TOKENS).find(([s]) => s === ':root[data-liquid-glass="native"]')![1];
    const veil = Number(/--lgd-fill:\s*rgba\(255, 255, 255, ([\d.]+)\)/.exec(tokens)![1]);
    const ink: Rgb = [AMBIENT_INK.r, AMBIENT_INK.g, AMBIENT_INK.b];
    for (const a of AMBIENT_DARK) {
      for (const b of AMBIENT_DARK) {
        if (a === b) continue;
        const ambient = over([b.color.r, b.color.g, b.color.b], b.alpha, over([a.color.r, a.color.g, a.color.b], a.alpha, ink));
        // Sur le fond nu et sur le voile d'un conteneur (blanc `--lgd-fill`).
        for (const under of [ambient, over([255, 255, 255], veil, ambient)]) {
          for (const alpha of [tertiary, 0.78]) {
            expect(contrast(over([255, 255, 255], alpha, under), under), `${alpha} : ${a.token} × ${b.token}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });

  it("le contenu est un VOILE (ni givre, ni ombre portée, ni liseré) ; seul ce qui se pose sur une image est du verre", () => {
    const panel = rules(CONTENT).find(([s]) => s === ':root[data-liquid-glass="native"] .lg-content')![1];
    expect(panel).toMatch(/var\(--lgd-fill\)/);
    expect(panel).toMatch(/box-shadow:\s*var\(--lgd-light\)/);
    expect(panel).toMatch(/backdrop-filter:\s*none/);
    for (const [selector, body] of rules(CONTENT)) {
      if (/backdrop-filter:\s*blur|--lg-pane-rim|--lg-pane-shadow/.test(body)) expect(selector).toContain(".lg-content-frosted");
    }
  });
});
