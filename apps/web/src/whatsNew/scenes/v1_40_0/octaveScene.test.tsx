/**
 * La scène d'Octave (nouveautés 1.40.0) : les mots de l'app, des pochettes inventées (aucune image d'artiste),
 * la houle et la mer en pause hors scène, figées au mouvement réduit ; une feuille qui tient les règles « Coût GPU ».
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// framer-motion a ici sa propre copie de React (rendu serveur impossible) : ses éléments deviennent de simples balises,
// sans les propriétés d'animation — la scène rend l'état de son pas, c'est ce qu'on lit.
vi.mock("framer-motion", async () => {
  const { createElement } = await import("react");
  const strip = (tag: string) =>
    function Plain({ initial: _i, animate: _a, transition: _t, exit: _e, ...rest }: Record<string, unknown>) {
      return createElement(tag, rest);
    };
  return { motion: new Proxy({}, { get: (_target, tag: string) => strip(tag) }), AnimatePresence: ({ children }: { children: unknown }) => children };
});

const { OctaveScene } = await import("./OctaveScene");

const CSS = readFileSync(join(__dirname, "octaveScene.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("la scène d'Octave", () => {
  it("au mouvement réduit, l'image finale : l'« en cours », sa mer, rien qui bouge", () => {
    const html = renderToStaticMarkup(<OctaveScene active reduced />);
    expect(html).toContain('data-reduced="1"');
    expect(html).toContain('data-run="0"');
    expect(html.match(/class="wn-oc-band /g)).toHaveLength(3);
    expect(html).toContain("music:shell.nowPlaying".toUpperCase());
  });

  it("au départ : Tentacle et sa bascule « Mode musique » (les vrais mots de l'app) ; hors scène, en pause", () => {
    const html = renderToStaticMarkup(<OctaveScene active={false} reduced={false} />);
    expect(html).toContain("music:mode.switchLabel");
    expect(html).toContain('data-run="0"');
    // Octave n'est pas encore monté : rien de caché ne coûte.
    expect(html).not.toContain("wn-oc-band");
    expect(renderToStaticMarkup(<OctaveScene active reduced={false} />)).toContain('data-run="1"');
  });

  it("aucune image d'artiste : seules des pochettes peintes, et le logo d'Octave", () => {
    const html = renderToStaticMarkup(<OctaveScene active reduced />);
    const images = Array.from(html.matchAll(/<img [^>]*src="([^"]+)"/g), (m) => m[1] as string);
    for (const src of images) expect(src.startsWith("data:image/svg+xml")).toBe(true);
    expect(html).not.toMatch(/\/api\/music\/artwork|Items\/.*\/Images/);
  });
});

describe("la feuille de la scène", () => {
  it("transform seul, deux étapes, par pas à 15 images par seconde", () => {
    for (const [, name, body] of CSS.matchAll(/@keyframes\s+(\w+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
      const steps = Array.from((body as string).matchAll(/([\w%]+)\s*\{([^}]*)\}/g));
      expect(steps.map((s) => s[1]), name).toEqual(["from", "to"]);
      for (const [, , decls] of steps) for (const [, prop] of (decls as string).matchAll(/([\w-]+)\s*:/g)) expect(prop, name).toBe("transform");
    }
    for (const [, seconds, n] of CSS.matchAll(/([\d.]+)s steps\((\d+)\)/g)) expect(Number(n)).toBe(Math.round(Number(seconds) * 15));
    for (const block of CSS.split("}")) {
      const duration = block.match(/animation-duration:\s*([\d.]+)s/)?.[1];
      const steps = block.match(/animation-timing-function:\s*steps\((\d+)\)/)?.[1];
      if (duration !== undefined) expect(Number(steps)).toBe(Math.round(Number(duration) * 15));
    }
  });

  it("en pause hors scène, rien au mouvement réduit, aucune primitive refusée par le client LG", () => {
    expect(CSS).toMatch(/\.wn-oc\[data-run="0"\] \.wn-oc-swell-wave,\s*\.wn-oc\[data-run="0"\] \.wn-oc-drift \{ animation-play-state: paused; \}/);
    expect(CSS).toMatch(/\.wn-oc\[data-reduced="1"\][^{]*\{ animation: none; \}/);
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(CSS).not.toMatch(/\b(min|max|clamp|color-mix)\(|backdrop-filter|filter\s*:|:(is|where|has)\(/);
  });
});
