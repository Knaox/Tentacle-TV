/**
 * Le mouvement « océan » tient les règles « Coût GPU » de CLAUDE.md : il
 * n'anime que `transform` et `opacity`, toute boucle avance PAR PAS sur UNE
 * cadence commune (15 images par seconde), les états qui ne se voient pas
 * suspendent, le mouvement réduit fige tout ; et les composants rendent ce
 * qu'il faut, sans rien d'interactif.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ snapshot: { wantsPlay: true, current: { key: "k" }, queue: { contextId: "album:a1" } } }));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../player/OctavePlayerProvider", () => ({
  usePlayerSelector: <T,>(select: (s: typeof h.snapshot) => T): T => select(h.snapshot),
}));
vi.mock("../components/Artwork", () => ({ useArtworkResolver: () => (url: string | null) => url }));

const { OceanSwell } = await import("./OceanSwell");
const { CollectionSwell, NowSwell } = await import("./NowSwell");
const { OceanAmbience } = await import("./OceanAmbience");

const CSS = readFileSync(join(__dirname, "oceanMotion.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Les blocs `sélecteur { corps }` de premier niveau et ceux des @media (les @keyframes à part). */
function rules(source: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ selector: (selector as string).trim(), body: body as string });
  return out;
}

function keyframes(source: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of source.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) out.set(m[1] as string, m[2] as string);
  return out;
}

describe("la feuille du mouvement océan", () => {
  it("les étapes n'animent que transform et opacity, et une animation n'a que deux étapes", () => {
    const frames = keyframes(CSS);
    expect(frames.size).toBeGreaterThanOrEqual(6);
    for (const [name, body] of frames) {
      const steps = Array.from(body.matchAll(/([\w%]+)\s*\{([^}]*)\}/g));
      expect(steps.map((s) => s[1]), name).toEqual(["from", "to"]);
      for (const [, , decls] of steps) {
        for (const [, prop] of (decls as string).matchAll(/([\w-]+)\s*:/g)) expect(["transform", "opacity"], `${name} → ${prop}`).toContain(prop);
      }
    }
  });

  it("toute boucle avance par pas, à 15 pas par seconde, et ses délais tombent sur la cadence", () => {
    let loops = 0;
    for (const { selector, body } of rules(CSS)) {
      const shorthand = body.match(/animation:\s*[\w-]+\s+([\d.]+)s\s+(steps\((\d+)\))?[^;]*;/);
      const duration = Number(body.match(/animation-duration:\s*([\d.]+)s/)?.[1] ?? shorthand?.[1] ?? Number.NaN);
      const steps = Number(body.match(/animation-timing-function:\s*steps\((\d+)\)/)?.[1] ?? shorthand?.[3] ?? Number.NaN);
      if (shorthand && /infinite/.test(shorthand[0])) {
        loops += 1;
        expect(shorthand[2], `${selector} : une boucle sans pas`).toBeDefined();
      }
      if (Number.isFinite(duration) && Number.isFinite(steps)) expect(steps, selector).toBe(Math.round(duration * 15));
      // Une durée surchargée sans ses pas romprait la cadence.
      if (/animation-duration/.test(body)) expect(body, selector).toMatch(/animation-timing-function:\s*steps\(/);
      const delay = body.match(/animation-delay:\s*(-?[\d.]+)s/)?.[1];
      if (delay !== undefined) expect(Number.isInteger(Math.round(Number(delay) * 15 * 1000) / 1000), selector).toBe(true);
    }
    expect(loops).toBe(4);
  });

  it("ce qui ne se voit pas (still) et la pause (rest) suspendent", () => {
    expect(CSS).toMatch(/\.oc-swell\[data-swell="still"\] \.oc-swell-wave,\s*\.oc-swell\[data-swell="rest"\] \.oc-swell-wave \{ animation-play-state: paused; \}/);
    expect(CSS).toMatch(/\.oc-ocean\[data-ocean="still"\] \*,\s*\.oc-ocean\[data-ocean="rest"\] \* \{ animation-play-state: paused; \}/);
  });

  it("l'amplitude (énergie de la musique) passe par une transition de transform PAR PAS, jamais continue", () => {
    const transitions = Array.from(CSS.matchAll(/transition:([^;]+);/g), (m) => m[1] as string).filter((t) => /transform/.test(t));
    expect(transitions.length).toBeGreaterThanOrEqual(2);
    for (const t of transitions) expect(t, t).toMatch(/transform \d+ms steps\(\d+, end\)/);
    expect(CSS).toMatch(/\.oc-swell-sea \{[^}]*scaleY\(calc\(0\.6 \+ 0\.4 \* var\(--ocean-amp, 1\)\)\)/);
    expect(CSS).toMatch(/\.oc-ocean-swell \{[^}]*scaleY\(var\(--ocean-amp, 1\)\)/);
  });

  it("le mouvement réduit fige tout ce qui bouge", () => {
    const reduced = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const cls of [".oc-swell-wave", ".oc-ocean-glow", ".oc-ocean-light", ".oc-ocean-band", ".oc-ocean-drift"]) expect(reduced).toContain(cls);
    expect(reduced).toMatch(/\.oc-ocean-swell \{ transition: none; \}/);
    expect(reduced).toMatch(/animation: none;/);
  });

  it("ni verre, ni flou, ni filtre, ni mélange, ni primitive refusée par le client LG", () => {
    expect(CSS).not.toMatch(/backdrop-filter|filter\s*:|mix-blend-mode|box-shadow\s*:[^;]*\btransition/);
    expect(CSS).not.toMatch(/\b(min|max|clamp|color-mix)\(/);
    expect(CSS).not.toMatch(/:(is|where|has)\(/);
  });
});

describe("les composants", () => {
  it("la houle : décorative, deux vagues qui glissent et la mer calme, à la couleur du texte", () => {
    const html = renderToStaticMarkup(<OceanSwell playing />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-swell="run"');
    expect(html.match(/oc-swell-wave/g)).toHaveLength(2);
    expect(html).toContain("oc-swell-calm");
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toMatch(/<button|tabindex/);
  });

  it("en pause, la mer se calme", () => {
    expect(renderToStaticMarkup(<OceanSwell playing={false} />)).toContain('data-swell="rest"');
  });

  it("la houle du titre en cours lit le lecteur", () => {
    h.snapshot.wantsPlay = false;
    expect(renderToStaticMarkup(<NowSwell />)).toContain('data-swell="rest"');
    h.snapshot.wantsPlay = true;
    expect(renderToStaticMarkup(<NowSwell />)).toContain('data-swell="run"');
  });

  it("la carte ne montre sa pastille que pour SON contexte, dite en mots", () => {
    const html = renderToStaticMarkup(<CollectionSwell contextId="album:a1" />);
    expect(html).toContain("oc-collection-swell");
    expect(html).toContain("track.nowPlaying");
    expect(renderToStaticMarkup(<CollectionSwell contextId="album:autre" />)).toBe("");
    expect(renderToStaticMarkup(<CollectionSwell contextId={null} />)).toBe("");
  });

  it("l'ambiance : trois bandes, trois reflets, une lueur, rien d'interactif, des dégradés aux identifiants sûrs", () => {
    const html = renderToStaticMarkup(<OceanAmbience artworkUrl={null} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-ocean="run"');
    expect(html.match(/class="oc-ocean-band /g)).toHaveLength(3);
    expect(html.match(/class="oc-ocean-light /g)).toHaveLength(3);
    expect(html.match(/oc-ocean-glow/g)).toHaveLength(1);
    for (const [, id] of html.matchAll(/url\(#([^)]+)\)/g)) expect(id).toMatch(/^[\w-]+$/);
    expect(html).not.toMatch(/<button|tabindex/);
  });
});
