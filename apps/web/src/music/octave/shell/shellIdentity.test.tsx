import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { nextHistoryRange } from "./useOctaveHistory";
import { RangeSlider } from "./RangeSlider";

/**
 * Octave — la coquille : ‹ › ne sortent jamais du mode, et la glissière
 * commune pose son remplissage et sa tête sans rien animer.
 */

describe("‹ › : l'historique d'Octave", () => {
  const entry = { base: 4, at: 4, max: 4 };

  it("une page nouvelle : on peut revenir, rien devant", () => {
    const r = nextHistoryRange(entry, 5, "PUSH");
    expect(r).toEqual({ base: 4, at: 5, max: 5 });
    expect(r.at > r.base).toBe(true);
    expect(r.at < r.max).toBe(false);
  });

  it("un retour garde la page d'où l'on vient « devant »", () => {
    const r = nextHistoryRange({ base: 4, at: 6, max: 6 }, 5, "POP");
    expect(r).toEqual({ base: 4, at: 5, max: 6 });
  });

  it("une page nouvelle après un retour efface ce qui était devant", () => {
    const r = nextHistoryRange({ base: 4, at: 5, max: 7 }, 6, "PUSH");
    expect(r.max).toBe(6);
  });

  it("revenu à l'entrée du mode : plus de retour (quitter, c'est la bascule)", () => {
    const r = nextHistoryRange({ base: 4, at: 5, max: 5 }, 4, "POP");
    expect(r.at > r.base).toBe(false);
  });

  it("un remplacement ne change ni l'entrée ni ce qui est devant", () => {
    expect(nextHistoryRange({ base: 4, at: 5, max: 6 }, 5, "REPLACE")).toEqual({ base: 4, at: 5, max: 6 });
  });
});

describe("la glissière commune", () => {
  it("le volume : un remplissage ROSE en échelle, la tête placée en `cqw`", () => {
    const html = renderToStaticMarkup(<RangeSlider fill="volume" ratio={0.5} min={0} max={100} value={50} aria-label="Volume" onChange={() => undefined} />);
    expect(html).toContain('data-fill="volume"');
    expect(html).toContain("transform:scaleX(0.5)");
    expect(html).toContain("--oc-at:0.5");
    expect(html).toContain('aria-label="Volume"');
  });

  it("une valeur hors bornes ou inconnue reste dans le rail", () => {
    expect(renderToStaticMarkup(<RangeSlider fill="progress" ratio={1.7} readOnly />)).toContain("scaleX(1)");
    expect(renderToStaticMarkup(<RangeSlider fill="progress" ratio={Number.NaN} readOnly />)).toContain("scaleX(0)");
  });

  it("désactivée, elle le dit (rail atténué, tête cachée)", () => {
    const html = renderToStaticMarkup(<RangeSlider fill="progress" ratio={0} disabled readOnly />);
    expect(html).toContain('data-disabled="true"');
    expect(html).toContain("disabled");
  });
});

describe("la colonne de droite du dock (O3-2 : jamais « Sans pe »)", () => {
  const css = readFileSync(join(__dirname, "shell.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  // Mesuré au banc (Inter) : état + pastille « Sans perte » (le plus long), file, bouton du volume, écarts.
  const META = 97;
  const FIXED = 36 + 40 + 3 * 6;
  const rules = Array.from(css.matchAll(/@container \(min-width: (\d+)px\) \{([\s\S]*?\})\s*\}/g), (m) => ({
    min: Number(m[1]),
    body: m[2] as string,
    slider: Number(/width: (\d+)px/.exec(m[2] as string)?.[1] ?? 0),
  }));

  it("est un conteneur ; la qualité y est cachée tant que la place manque", () => {
    expect(css).toMatch(/\.octave-dock-aside\s*\{\s*container-type:\s*inline-size;/);
    expect(css).toMatch(/\.octave-dock-meta\s*\{\s*display:\s*none;/);
  });

  it("chaque palier tient EN ENTIER ce qu'il montre", () => {
    const metaAt = rules.find((r) => /octave-dock-meta \{ display: inline-flex/.test(r.body))?.min ?? Number.NaN;
    expect(metaAt).toBeGreaterThan(0);
    for (const r of rules) {
      if (!r.slider) continue;
      // Avec la qualité : elle, plus ce qui reste ; sans elle : un écart de moins.
      const needed = r.min >= metaAt ? META + FIXED + r.slider : FIXED - 6 + r.slider;
      expect(r.min, `palier ${r.min}px, glissière ${r.slider}px`).toBeGreaterThanOrEqual(needed);
    }
  });
});
