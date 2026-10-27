import { describe, expect, it } from "vitest";
import { materializeFrom } from "./materialize";
import type { GlassMaterialize, NativeGlassRegion } from "./protocol";
import { GlassRegions } from "./regions";
import { FakeBackend, manualTimers, type FakeView } from "./testkit";
import { parseBatch } from "./validate";

const M: GlassMaterialize = {
  rise: 6, scale: 0.96, originX: 0.5, originY: 0.5, delay: 30, exit: 180,
  enterEase: [0.2, 0.9, 0.3, 1], exitEase: [0.4, 0, 1, 1],
};

function region(id: string, extra: Partial<NativeGlassRegion> = {}): NativeGlassRegion {
  return { id, x: 100, y: 700, width: 200, height: 48, radius: 24, level: "clear", tint: null, interactive: false, z: 0, transition: 340, materialize: M, ...extra };
}

function setup() {
  const backend = new FakeBackend();
  const timers = manualTimers();
  const regions = new GlassRegions(backend, timers, () => undefined);
  const upsert = (...list: NativeGlassRegion[]) => regions.apply({ upserts: list, removes: [] }, 1);
  const remove = (...ids: string[]) => regions.apply({ upserts: [], removes: ids }, 1);
  const containers = (): FakeView[] => backend.content.children.find((v) => v.kind === "root")?.children ?? [];
  return { backend, timers, regions, upsert, remove, containers };
}

describe("materializeFrom — le cadre de départ", () => {
  it("réduit autour de l'origine, puis descend de `rise` (axe d'AppKit : vers le bas, y diminue)", () => {
    const frame = { x: 100, y: 52, width: 200, height: 48 };
    expect(materializeFrom(frame, M, 1)).toEqual({ x: 104, y: 52 + 0.96 - 6, width: 192, height: 46.08 });
    // Origine en bas à droite (un popover qui naît de son bouton) : le coin bas-droit ne bouge pas.
    const corner = materializeFrom(frame, { ...M, rise: 0, originX: 1, originY: 1 }, 1);
    expect(corner.x + corner.width).toBeCloseTo(300);
    expect(corner.y).toBeCloseTo(52);
    // Zoom 2 : le décalage est en px CSS.
    expect(materializeFrom(frame, { ...M, scale: 1 }, 2).y).toBe(52 - 12);
  });
});

describe("GlassRegions — une région qui se matérialise", () => {
  it("naît transparente, au cadre de départ ; après son décalage, monte et s'allume sur la courbe de la page", () => {
    const t = setup();
    t.upsert(region("transport"));
    const [container] = t.containers();
    const glass = container?.children[0]?.children[0];
    expect(container?.alpha).toBe(0);
    expect(glass?.frame.width).toBeCloseTo(192);
    expect(t.backend.ops).not.toContain("setFrame ressort 340");
    t.timers.runAll(); // le décalage
    expect(t.backend.ops).toContain("setFrame ressort 340");
    expect(t.backend.ops).toContain("setAlpha container 1 340 [0.2,0.9,0.3,1]");
    expect(glass?.frame).toEqual({ x: 100, y: 52, width: 200, height: 48 });
  });

  it("sans décalage, l'entrée attend quand même un tour (le cadre de départ validé d'abord — mesuré)", () => {
    const t = setup();
    t.upsert(region("transport", { materialize: { ...M, delay: 0 } }));
    expect(t.backend.ops).not.toContain("setAlpha container 1 340 [0.2,0.9,0.3,1]");
    expect(t.timers.size()).toBe(1);
    t.timers.runAll();
    expect(t.backend.ops).toContain("setAlpha container 1 340 [0.2,0.9,0.3,1]");
  });

  it("chaque forme a SON conteneur : leurs fondus sont décalés, pas partagés", () => {
    const t = setup();
    t.upsert(region("a"), region("b", { x: 320, materialize: { ...M, delay: 60 } }));
    expect(t.containers()).toHaveLength(2);
  });

  it("sort plus vite qu'elle n'entre : redescend vers son départ pendant que son conteneur s'éteint, puis 0 vue", () => {
    const t = setup();
    t.upsert(region("transport"));
    t.timers.runAll();
    t.backend.ops.length = 0;
    t.remove("transport");
    expect(t.backend.ops).toEqual(["setFrame ressort 180", "setAlpha container 0 180 [0.4,0,1,1]"]);
    expect(t.backend.frames.at(-1)?.width).toBeCloseTo(192);
    expect(t.regions.snapshot().nativeViews).toBe(1);
    t.timers.runAll();
    expect(t.regions.snapshot()).toMatchObject({ nativeViews: 0, root: false });
  });

  it("retirée AVANT son décalage : l'entrée n'a jamais lieu, aucune poignée rendue n'est touchée", () => {
    const t = setup();
    t.upsert(region("transport"));
    t.remove("transport");
    expect(() => t.timers.runAll()).not.toThrow();
    expect(t.backend.ops).not.toContain("setAlpha container 1 340 [0.2,0.9,0.3,1]");
    expect(t.regions.snapshot().nativeViews).toBe(0);
  });

  it("le réglage coupé pendant le décalage annule l'entrée ; rallumé, la forme revient posée, sans mouvement", () => {
    const t = setup();
    t.upsert(region("transport"));
    t.regions.setEnabled(false);
    expect(() => t.timers.runAll()).not.toThrow();
    t.regions.setEnabled(true);
    const [container] = t.containers();
    expect(container?.alpha).toBe(1);
    expect(container?.children[0]?.children[0]?.frame).toEqual({ x: 100, y: 52, width: 200, height: 48 });
  });

  it("dans un groupe, pas de matérialisation : le comportement d'avant (fondu du groupe entier)", () => {
    const t = setup();
    t.upsert(region("a", { group: "player" }));
    expect(t.backend.ops).toContain("setAlpha container 1 340");
    expect(t.timers.size()).toBe(0);
  });
});

describe("parseBatch — `materialize`", () => {
  it("laisse passer une matérialisation propre, refuse une courbe hors de [0, 1] ou une échelle folle", () => {
    const ok = parseBatch({ upserts: [region("a")], removes: [] });
    expect(ok?.batch.upserts[0]?.materialize).toEqual(M);
    const bad = parseBatch({
      upserts: [region("b", { materialize: { ...M, enterEase: [0, 1.4, 0.3, 1] } }), region("c", { materialize: { ...M, scale: 0 } })],
      removes: [],
    });
    expect(bad?.rejected).toBe(2);
  });
});
