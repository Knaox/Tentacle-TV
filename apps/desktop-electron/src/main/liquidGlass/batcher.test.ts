import { describe, expect, it } from "vitest";
import { createGlassBatcher } from "./batcher";
import type { LiquidGlassBatch, NativeGlassRegion } from "./protocol";

function region(id: string, extra: Partial<NativeGlassRegion> = {}): NativeGlassRegion {
  return { id, x: 10, y: 20, width: 300, height: 44, radius: 22, level: "regular", tint: null, interactive: false, z: 0, ...extra };
}

/** Un lot regroupé, vidé à la main : le vidage réel est une microtâche. */
function harness() {
  const sent: LiquidGlassBatch[] = [];
  let pending: (() => void) | null = null;
  let scheduled = 0;
  const batcher = createGlassBatcher(
    (batch) => sent.push(batch),
    (flush) => {
      scheduled += 1;
      pending = flush;
    },
  );
  const flush = (): void => {
    const run = pending;
    pending = null;
    run?.();
  };
  return { batcher, sent, flush, scheduled: () => scheduled };
}

describe("createGlassBatcher", () => {
  it("tout ce qu'une tâche envoie part en UN message", () => {
    const h = harness();
    h.batcher.setEnabled(true);
    h.batcher.upsert([region("a"), region("b")]);
    h.batcher.remove(["c"]);
    h.batcher.upsert([region("d")]);
    expect(h.scheduled()).toBe(1);
    h.flush();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]?.enabled).toBe(true);
    expect(h.sent[0]?.upserts.map((r) => r.id)).toEqual(["a", "b", "d"]);
    expect(h.sent[0]?.removes).toEqual(["c"]);
  });

  it("le dernier mot gagne, région par région", () => {
    const h = harness();
    h.batcher.upsert([region("a", { x: 1 })]);
    h.batcher.upsert([region("a", { x: 2 })]);
    h.batcher.upsert([region("b")]);
    h.batcher.remove(["b"]);
    h.batcher.remove(["c"]);
    h.batcher.upsert([region("c")]);
    h.flush();
    const batch = h.sent[0];
    expect(batch?.upserts.map((r) => [r.id, r.x])).toEqual([
      ["a", 2],
      ["c", 10],
    ]);
    expect(batch?.removes).toEqual(["b"]);
  });

  it("rien à dire, rien d'envoyé — et le lot suivant repart de zéro", () => {
    const h = harness();
    h.flush();
    expect(h.sent).toHaveLength(0);
    h.batcher.upsert([region("a")]);
    h.flush();
    h.batcher.remove(["a"]);
    h.flush();
    expect(h.sent).toHaveLength(2);
    expect(h.sent[1]).toEqual({ upserts: [], removes: ["a"] });
    expect(h.scheduled()).toBe(2);
  });

  it("ne recopie que les champs du protocole", () => {
    const h = harness();
    const polluted = { ...region("a", { group: "lecteur", transition: 200 }), onclick: () => 1, secret: "x" };
    h.batcher.upsert([polluted as NativeGlassRegion]);
    h.flush();
    expect(Object.keys(h.sent[0]?.upserts[0] ?? {}).sort()).toEqual(
      ["group", "height", "id", "interactive", "level", "radius", "tint", "transition", "width", "x", "y", "z"].sort(),
    );
  });

  it("laisse passer CHAQUE champ facultatif du protocole (vécu : `materialize` perdu ici, en silence)", () => {
    const h = harness();
    const full: Required<NativeGlassRegion> = {
      ...region("a"), group: "g", spacing: 8, transition: 340, spring: { response: 0.42, dampingFraction: 0.84 }, appearance: "dark",
      materialize: { rise: 6, scale: 0.96, originX: 0.5, originY: 1, delay: 30, exit: 180, enterEase: [0.2, 0.9, 0.3, 1], exitEase: [0.4, 0, 1, 1] },
    };
    h.batcher.upsert([{ ...full, materialize: { ...full.materialize, extra: 1 } as never }]);
    h.flush();
    expect(h.sent[0]?.upserts[0]).toEqual(full);
  });

  it("une entrée sans identifiant est ignorée, sans faire tomber le preload", () => {
    const h = harness();
    h.batcher.upsert([null, { x: 1 }, region("ok")] as unknown as NativeGlassRegion[]);
    h.batcher.remove([42, "z"] as unknown as string[]);
    h.flush();
    expect(h.sent[0]?.upserts.map((r) => r.id)).toEqual(["ok"]);
    expect(h.sent[0]?.removes).toEqual(["z"]);
  });
});
