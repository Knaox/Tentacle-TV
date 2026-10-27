import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { StillWatchingController } from "@tentacle-tv/api-client";

/**
 * Les couleurs du lecteur en verre (lot lg7) : la couche fonctionnelle est BLANCHE
 * (progression, volume, décompte), l'accent est UNI, aucun dégradé de marque ; et
 * hors de la porte, l'habillage d'avant garde ses dégradés à l'identique.
 */

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// framer-motion embarque sa propre copie de React sous Node : remplacé, classes gardées.
vi.mock("framer-motion", async () => {
  const { createElement } = await import("react");
  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useIsPresent: () => true,
    useReducedMotion: () => false,
    motion: new Proxy({}, {
      get: (_, tag: string) => ({ children, className }: { children?: ReactNode; className?: string }) => createElement(tag, { className }, children),
    }),
  };
});

const { StillWatchingPrompt } = await import("../StillWatchingPrompt");
const { PlayerGlassModeContext } = await import("./PlayerGlassContext");
const { EdgeArrows } = await import("../../scroll/EdgeArrows");

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const SHEETS = readdirSync(__dirname).filter((n) => n.endsWith(".css")).map((n) => strip(readFileSync(join(__dirname, n), "utf8"))).join("\n");

const asking: StillWatchingController = {
  phase: "asking", remainingMs: 5_000, countdownMs: 10_000,
  reportActivity: vi.fn(), keepWatching: vi.fn(), pauseNow: vi.fn(), resume: vi.fn(),
};
const prompt = (mode: "native" | "legacy") => renderToStaticMarkup(
  <PlayerGlassModeContext.Provider value={mode}>
    <StillWatchingPrompt controller={asking} controlsVisible={false} surface="desktop" />
  </PlayerGlassModeContext.Provider>,
);

describe("les couleurs du lecteur en verre", () => {
  it("piste blanche, partie lue au dégradé de marque d'avant ; aucun autre dégradé de couleur", () => {
    expect(SHEETS).toMatch(/--lg-player-track:\s*rgb\(255 255 255 \/ 0\.3\)/);
    expect(SHEETS).toMatch(/--lg-player-track-fill:\s*rgb\(255 255 255 \/ 0\.9\)/);
    // La barre et le volume reprennent le violet → rose de la marque (Damien, 27/10), en teintes claires.
    expect(SHEETS).toMatch(/--lg-player-progress-fill:\s*linear-gradient\(90deg, var\(--brand-light\), var\(--brand-accent-light\)\)/);
    expect(SHEETS).toMatch(/\.lgp-scrub__fill \{[^}]*background: var\(--lg-player-progress-fill\)/);
    // Un dégradé de MASQUE (l'image de « à suivre ») n'est pas une couleur de marque.
    // …ni le jeton de la partie lue, la seule couleur de marque admise en dégradé.
    const colours = SHEETS.replace(/mask-image:[^;]*;/g, "").replace(/--lg-player-progress-fill:[^;]*;/, "");
    expect(colours).not.toMatch(/--progress-fill|--ctl-gradient/);
    // Seul dégradé admis : du NOIR à alpha (le cœur atténué des ronds, lg8) — jamais une couleur.
    const gradients = [...colours.matchAll(/(?:linear|radial)-gradient\(([^;]*)\);/g)].map((m) => m[1]!);
    for (const gradient of gradients) {
      const tints = gradient.match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)|var\(--[a-z0-9-]+\)/gi) ?? [];
      expect(tints.every((tint) => /^rgba?\(0 0 0\b/.test(tint) || tint.startsWith("var(--lg-player-dim"))).toBe(true);
    }
    // La saison affichée : le jeton du dégradé y reçoit l'accent uni.
    expect(SHEETS).toMatch(/--season-tab-gradient:\s*var\(--lg-player-accent\)/);
  });

  it("titres de section des panneaux à #ececf0, étiquettes sans trait", () => {
    expect(SHEETS).toMatch(/--lg-player-fg-3:\s*#ececf0/);
    const chip = /\.lgp-chip \{([^}]*)\}/.exec(SHEETS)?.[1] ?? "";
    expect(chip).not.toMatch(/border\s*:/);
  });

  it("« Vous regardez encore » : blanc et accent uni en verre, dégradés d'avant hors porte", () => {
    const glass = prompt("native");
    expect(glass).toContain("lgp-card__fill");
    expect(glass).toContain("lgp-card__primary");
    expect(glass).not.toContain("bg-gradient-to-r");
    const legacy = prompt("legacy");
    expect(legacy.match(/bg-gradient-to-r from-\[var\(--brand\)\] to-\[var\(--brand-accent\)\]/g)).toHaveLength(2);
    expect(legacy).not.toContain("lgp-card__");
  });

  it("flèches de bord : le chevron seul dans le lecteur, le disque ailleurs", () => {
    const props = { canLeft: true, canRight: true, mounted: true, shown: true, onScroll: () => {} };
    const glyph = renderToStaticMarkup(<EdgeArrows {...props} look="glyph" />);
    expect(glyph.match(/lgp-edge-arrow/g)).toHaveLength(2);
    expect(glyph).not.toContain("backdrop-blur");
    expect(renderToStaticMarkup(<EdgeArrows {...props} />)).not.toContain("lgp-edge-arrow");
  });
});
