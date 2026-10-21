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

  it("n'anime que des propriétés composées (scale, translate, opacity)", () => {
    const animated = [...css.matchAll(/transition:\s*([a-z-]+)\s/g)].map((m) => m[1]);
    expect(animated.length).toBeGreaterThan(0);
    for (const p of animated) expect(["scale", "translate", "opacity", "transform", "none"]).toContain(p);
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
});
