/**
 * Les mouvements d'ambiance des bannières (`heroMotion.css`) : durées et
 * paliers écrits en dur dans la feuille, qui doivent suivre la durée d'une
 * diapositive (`HERO_ZOOM_DURATION_S`) et la cadence d'ambiance
 * (`AMBIENT_HZ`). Une dérive désaccorderait les paliers du fond, du halo et de
 * la pastille : deux images recomposées par palier au lieu d'une.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HERO_ZOOM_DURATION_S } from "../components/hero/HeroBackdrop";
import { AMBIENT_HZ } from "./motion";

const CSS = readFileSync(join(__dirname, "heroMotion.css"), "utf8");

describe("heroMotion.css", () => {
  it.each(["hero-zoom", "hero-halo-zoom"])("%s suit la durée d'une diapositive et la cadence d'ambiance", (name) => {
    const steps = Math.round(AMBIENT_HZ * HERO_ZOOM_DURATION_S);
    expect(CSS).toContain(`.${name} {\n  animation: ${name} ${HERO_ZOOM_DURATION_S}s steps(${steps}, end) both;`);
  });

  it("n'anime que `transform` — rien à repeindre, tout au compositeur", () => {
    const keyframes = [...CSS.matchAll(/@keyframes [\w-]+ \{([^@]*?)\n\}/g)].map((m) => m[1]);
    expect(keyframes).toHaveLength(3);
    for (const body of keyframes) {
      const properties = [...body.matchAll(/([\w-]+):/g)].map((m) => m[1]);
      expect(new Set(properties)).toEqual(new Set(["transform"]));
    }
  });

  it("n'emploie pas la propriété `scale` seule, inconnue du Chromium des téléviseurs LG", () => {
    expect(CSS).not.toMatch(/^\s*scale:/m);
  });

  it("coupe le travelling sous le mouvement réduit", () => {
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.hero-zoom,\s*\.hero-halo-zoom \{\s*animation: none;/);
  });
});
