import { describe, expect, it, vi } from "vitest";
import type { NativeGlassRegion } from "../../desktop/types";
import { regionFromBox, type MeasuredBox, type RegionSpec } from "./regionGeometry";
import { createRegionScheduler, REGION_IDLE_FRAMES } from "./regionScheduler";
import { bindRegion } from "./useLiquidGlassRegion";

/**
 * L'ordonnanceur des régions natives : un envoi par image au plus, seulement
 * ce qui change, le retrait d'une région cachée ou démontée, le sommeil quand
 * plus rien ne bouge — et les observateurs du document posés tant qu'une
 * région existe, pas plus.
 */

const spec: RegionSpec = { level: "regular", shape: "capsule", tint: "brand", interactive: true, z: 0 };

function harness() {
  const frames: Array<() => void> = [];
  const boxes = new Map<Element, MeasuredBox | null>();
  const bridge = { upsert: vi.fn<(r: readonly NativeGlassRegion[]) => void>(), remove: vi.fn<(ids: readonly string[]) => void>() };
  const watch = { start: vi.fn(), stop: vi.fn(), observe: vi.fn(), unobserve: vi.fn() };
  const readStyle = vi.fn(() => ({ radius: 12, tint: "#8B5CF661" }));
  const scheduler = createRegionScheduler({
    bridge,
    requestFrame: (callback) => frames.push(callback),
    cancelFrame: () => frames.splice(0),
    viewport: () => ({ width: 1000, height: 800 }),
    readStyle,
    measure: (id, element, regionSpec, style, viewport) => {
      const box = boxes.get(element) ?? null;
      return box === null ? null : regionFromBox(id, box, regionSpec, style, viewport);
    },
    watch,
  });
  /** Joue les images en attente, une par une, jusqu'au sommeil (borné). */
  const runFrames = (limit = 50): number => {
    let count = 0;
    while (frames.length > 0 && count < limit) {
      frames.shift()?.();
      count++;
    }
    return count;
  };
  const element = (box: MeasuredBox | null): Element => {
    const node = {} as Element;
    boxes.set(node, box);
    return node;
  };
  return { scheduler, bridge, watch, readStyle, runFrames, element, boxes, frames };
}

const box = (x: number, y = 10): MeasuredBox => ({ x, y, width: 120, height: 40, layoutWidth: 120 });

describe("createRegionScheduler", () => {
  it("une inscription : un seul upsert à l'image suivante, puis le sommeil", () => {
    const h = harness();
    const node = h.element(box(10));
    h.scheduler.register("a", node, spec);
    expect(h.bridge.upsert).not.toHaveBeenCalled();
    const played = h.runFrames();
    expect(h.bridge.upsert).toHaveBeenCalledTimes(1);
    expect(h.bridge.upsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: "a", x: 10, y: 10, width: 120, height: 40, radius: 20, tint: "#8B5CF661", interactive: true }),
    ]);
    // Une image d'envoi, puis les images de garde, puis plus rien.
    expect(played).toBe(1 + REGION_IDLE_FRAMES);
    expect(h.frames).toHaveLength(0);
  });

  it("plusieurs régions : regroupées dans le même envoi", () => {
    const h = harness();
    h.scheduler.register("a", h.element(box(10)), spec);
    h.scheduler.register("b", h.element(box(200)), spec);
    h.runFrames();
    expect(h.bridge.upsert).toHaveBeenCalledTimes(1);
    expect(h.bridge.upsert.mock.calls[0][0].map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("un défilement : seule la région qui a bougé repart", () => {
    const h = harness();
    const a = h.element(box(10));
    h.scheduler.register("a", a, spec);
    h.scheduler.register("b", h.element(box(200)), spec);
    h.runFrames();
    h.boxes.set(a, box(10, 60));
    h.scheduler.heat();
    h.runFrames();
    expect(h.bridge.upsert).toHaveBeenCalledTimes(2);
    expect(h.bridge.upsert.mock.calls[1][0]).toEqual([expect.objectContaining({ id: "a", y: 60 })]);
  });

  it("réveillée sans changement : aucun message", () => {
    const h = harness();
    h.scheduler.register("a", h.element(box(10)), spec);
    h.runFrames();
    h.scheduler.heat();
    h.runFrames();
    expect(h.bridge.upsert).toHaveBeenCalledTimes(1);
    expect(h.bridge.remove).not.toHaveBeenCalled();
  });

  it("cachée puis revenue : retirée, puis renvoyée", () => {
    const h = harness();
    const a = h.element(box(10));
    h.scheduler.register("a", a, spec);
    h.runFrames();
    h.boxes.set(a, null);
    h.scheduler.heat();
    h.runFrames();
    expect(h.bridge.remove).toHaveBeenCalledWith(["a"]);
    h.boxes.set(a, box(10));
    h.scheduler.heat();
    h.runFrames();
    expect(h.bridge.upsert).toHaveBeenCalledTimes(2);
  });

  it("le démontage retire la région ; jamais envoyée, rien à retirer", () => {
    const h = harness();
    const a = h.element(box(10));
    const ghost = h.element(null);
    const unbind = bindRegion(h.scheduler, "a", a, spec);
    h.scheduler.register("ghost", ghost, spec);
    h.runFrames();
    unbind();
    h.scheduler.unregister("ghost");
    h.runFrames();
    expect(h.bridge.remove).toHaveBeenCalledTimes(1);
    expect(h.bridge.remove).toHaveBeenCalledWith(["a"]);
    expect(h.scheduler.size).toBe(0);
  });

  it("les observateurs vivent tant qu'une région existe", () => {
    const h = harness();
    const a = h.element(box(10));
    const b = h.element(box(200));
    h.scheduler.register("a", a, spec);
    h.scheduler.register("b", b, spec);
    expect(h.watch.start).toHaveBeenCalledTimes(1);
    expect(h.watch.observe).toHaveBeenCalledWith(a);
    h.scheduler.unregister("a");
    expect(h.watch.stop).not.toHaveBeenCalled();
    h.scheduler.unregister("b");
    expect(h.watch.stop).toHaveBeenCalledTimes(1);
    expect(h.watch.unobserve).toHaveBeenCalledWith(b);
  });

  it("le style ne se relit qu'à l'inscription, au changement de description ou sur demande", () => {
    const h = harness();
    h.scheduler.register("a", h.element(box(10)), spec);
    h.runFrames();
    h.scheduler.heat();
    h.runFrames();
    expect(h.readStyle).toHaveBeenCalledTimes(1);
    h.scheduler.heat(true);
    h.runFrames();
    h.scheduler.update("a", { ...spec, level: "tinted" });
    h.runFrames();
    expect(h.readStyle).toHaveBeenCalledTimes(3);
    expect(h.bridge.upsert.mock.calls.at(-1)?.[0]).toEqual([expect.objectContaining({ level: "tinted" })]);
  });

  it("la page s'en va : tout est retiré sur-le-champ", () => {
    const h = harness();
    h.scheduler.register("a", h.element(box(10)), spec);
    h.scheduler.register("b", h.element(box(200)), spec);
    h.runFrames();
    h.scheduler.clear();
    expect(h.bridge.remove).toHaveBeenCalledWith(["a", "b"]);
  });

  it("un pont qui lève ne casse ni la boucle ni la page", () => {
    const h = harness();
    h.bridge.upsert.mockImplementation(() => {
      throw new Error("coquille rechargée");
    });
    h.scheduler.register("a", h.element(box(10)), spec);
    expect(() => h.runFrames()).not.toThrow();
  });
});
