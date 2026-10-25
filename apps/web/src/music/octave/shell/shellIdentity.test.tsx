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
  // Mesuré au banc (Inter) : état + mot « Sans perte » (le plus long), icône de qualité, file, bouton du volume, écart.
  const LABEL = 97;
  const ICON = 22;
  const QUEUE = 36;
  const VOLUME_BUTTON = 40;
  const GAP = 6;
  const rules = Array.from(css.matchAll(/@container \(min-width: (\d+)px\) \{([\s\S]*?\})\s*\}/g), (m) => ({
    min: Number(m[1]),
    body: m[2] as string,
  })).sort((a, b) => a.min - b.min);

  it("est un conteneur ; au plus étroit, ni qualité ni glissière (le bouton muet reste)", () => {
    expect(css).toMatch(/\.octave-dock-aside\s*\{\s*container-type:\s*inline-size;/);
    expect(css).toMatch(/\.octave-dock-meta,\s*\.octave-dock-availability,\s*\.octave-dock-quality-label\s*\{\s*display:\s*none;/);
    expect(css).toMatch(/\.octave-range\.octave-dock-volume\s*\{\s*display:\s*none;/);
  });

  it("chaque palier tient EN ENTIER ce qu'il montre (mot, ou icône seule, ou rien)", () => {
    let meta = false;
    let label = false;
    let slider = 0;
    let sliderWidth = 64;
    for (const rule of rules) {
      if (/\.octave-dock-meta \{ display: inline-flex; \}/.test(rule.body)) meta = true;
      if (/\.octave-dock-quality-label \{ display: inline-flex; \}/.test(rule.body)) label = true;
      if (/\.octave-range\.octave-dock-volume \{ display: flex; \}/.test(rule.body)) slider = 1;
      const width = /\.octave-range\.octave-dock-volume \{ width: (\d+)px; \}/.exec(rule.body)?.[1];
      if (width) sliderWidth = Number(width);
      const volume = VOLUME_BUTTON + (slider ? sliderWidth : 0);
      const needed = meta ? (label ? LABEL : ICON) + QUEUE + volume + 2 * GAP : QUEUE + volume + GAP;
      expect(rule.min, `palier ${rule.min}px`).toBeGreaterThanOrEqual(needed);
    }
    // L'icône seule existe bien entre les deux : elle paraît AVANT le mot.
    expect(meta && label).toBe(true);
  });
});
