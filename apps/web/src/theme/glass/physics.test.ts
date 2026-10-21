import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GLASS_SPRINGS, springToCssLinear } from "./springs";

const css = readFileSync(join(__dirname, "physics.css"), "utf8");

const token = (name: string): string | undefined =>
  new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1].trim();

describe("physics.css", () => {
  it("porte les ressorts EXACTS de springs.ts (feuille générée, jamais retouchée)", () => {
    for (const [name, spring] of Object.entries(GLASS_SPRINGS)) {
      const { easing, durationMs } = springToCssLinear(spring);
      expect(token(`--lg-spring-${name}-easing`)).toBe(easing);
      expect(token(`--lg-spring-${name}-duration`)).toBe(`${durationMs}ms`);
    }
  });

  it("n'anime au ressort que des propriétés composées ; aucune animation infinie", () => {
    const sprung = [...css.matchAll(/([a-z-]+)\s+var\(--lg-spring-[a-z]+-duration\)/g)].map((m) => m[1]);
    expect(sprung.length).toBeGreaterThan(0);
    for (const p of sprung) expect(["scale", "translate", "opacity", "transform"]).toContain(p);
    expect(css).not.toMatch(/@keyframes|animation:/);
  });

  it("ne touche jamais les jetons hérités du verre", () => {
    expect(css).not.toMatch(/--glass-tint\s*:|--blur-[a-z]+\s*:/);
  });

  it("n'agit sur le matériau qu'en mode natif", () => {
    const blocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)];
    for (const [, selector, body] of blocks) {
      if (/--lgc?-(regular|clear|tinted|prominent)-fill|--lgc-backdrop|--lg-rim\s*:/.test(body)) {
        expect(selector).toContain('[data-liquid-glass="native"]');
      }
    }
  });

  it("sous Réduire la transparence / Contraste accru, le verre sur média reste sombre", () => {
    const block = /html\[data-liquid-glass="native"\]\[data-lg-material\] \{([^}]*)\}/.exec(css)?.[1] ?? "";
    for (const token of ["--lgc-media-dim", "--lgc-fill-media-icons", "--lgc-badge-dim", "--lg-media-dim", "--lg-clear-dim"]) {
      expect(block).toContain(`${token}: var(--lg-a11y-solid-media)`);
    }
    for (const token of ["--lg-label-shadow", "--lg-glyph-shadow", "--lg-media-label-shadow", "--lg-media-glyph-shadow"]) {
      expect(block).toContain(`${token}: none`);
    }
    expect(block).toContain("--lg-highlight: transparent");
  });
});
