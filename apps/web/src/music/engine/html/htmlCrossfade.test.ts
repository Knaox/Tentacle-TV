import { describe, expect, it } from "vitest";
import type { EngineEvent } from "@tentacle-tv/shared/music";
import { FakeElement, FakeTimers, testSource, testTrack } from "../engineTestKit";
import { HtmlAudioEngine } from "./htmlAudioEngine";

function rig(crossfadeMs = 6_000) {
  const timers = new FakeTimers();
  const elements: FakeElement[] = [];
  const engine = new HtmlAudioEngine({
    createElement: () => {
      const el = new FakeElement();
      elements.push(el);
      return el;
    },
    resolveUrl: (url) => url,
    credentials: null,
    canPlayType: () => "probably",
    ...timers,
  });
  engine.setCrossfade(crossfadeMs);
  const events: EngineEvent[] = [];
  engine.subscribe((e) => events.push(e));
  return { engine, timers, elements, events };
}

/** t1 joue (200 s), t2 d'un autre album est préchargé ; le courant arrive à 7 s de sa fin (fondu armé à 7,5 s). */
function nearEnd(r: ReturnType<typeof rig>) {
  r.engine.play(testTrack("t1", "A"), testSource("/a"), 0);
  r.engine.setNext(testTrack("t2", "B"), testSource("/b"));
  const [a, b] = r.elements as [FakeElement, FakeElement];
  a.loaded(200);
  a.currentTime = 193;
  a.fire("timeupdate");
  return { a, b };
}

const advanced = (events: EngineEvent[]) => events.filter((e) => e.type === "advanced");

describe("moteur <audio> — transition douce", () => {
  it("lance le suivant AVANT la fin et mène les deux volumes à puissance constante", () => {
    const r = rig();
    const { a, b } = nearEnd(r);
    r.timers.tick(999);
    expect(b.plays).toBe(0);
    r.timers.tick(1);
    expect(b.plays).toBe(1);
    expect(b.volume).toBe(0);
    expect(a.volume).toBe(1);
    for (const t of [0.6, 1.5, 2.4, 2.9]) {
      b.currentTime = t;
      r.timers.tick(10);
      expect(a.volume ** 2 + b.volume ** 2).toBeCloseTo(1, 9);
    }
    expect(b.volume).toBeCloseTo(Math.sin((Math.PI / 2) * (2.9 / 6)), 9);
    // Avant la mi-fondu, le courant est toujours t1.
    expect(advanced(r.events)).toEqual([]);
    b.currentTime = 3;
    r.timers.tick(10);
    expect(advanced(r.events)).toEqual([{ type: "advanced", fromKey: "t1", toKey: "t2" }]);
    expect(r.engine.getState().trackKey).toBe("t2");
    expect(a.volume).toBeCloseTo(Math.SQRT1_2, 9);
    b.currentTime = 6;
    r.timers.tick(10);
    expect(a.src).toBe("");
    expect(b.volume).toBe(1);
  });

  it("enchaîne SANS fondu à l'intérieur d'un album écouté dans l'ordre", () => {
    const r = rig();
    r.engine.play({ ...testTrack("t1", "A"), trackNumber: 1 }, testSource("/a"), 0);
    r.engine.setNext({ ...testTrack("t2", "A"), trackNumber: 2 }, testSource("/b"));
    const [a, b] = r.elements as [FakeElement, FakeElement];
    a.loaded(200);
    a.currentTime = 192;
    a.fire("timeupdate");
    r.timers.tick(5_000);
    expect(b.plays).toBe(0);
    a.currentTime = 199;
    a.fire("timeupdate");
    r.timers.tick(990);
    expect(b.plays).toBe(1);
    expect(b.volume).toBe(1);
  });

  it("un geste lâche le titre quitté aussitôt (le navigateur adoucit l'arrêt lui-même)", () => {
    const r = rig();
    r.engine.play(testTrack("t1"), testSource("/a"), 0);
    const a = r.elements[0] as FakeElement;
    r.engine.play(testTrack("t3"), testSource("/c"), 0);
    expect(a.src).toBe("");
    expect(r.engine.getState().trackKey).toBe("t3");
  });

  it("un saut avant la mi-fondu rend au suivant sa place, muet, et le courant à plein volume", () => {
    const r = rig();
    const { a, b } = nearEnd(r);
    r.timers.tick(1_000);
    b.currentTime = 1;
    r.timers.tick(10);
    r.engine.seek(30_000);
    expect(b.paused).toBe(true);
    expect(b.currentTime).toBe(0);
    expect(a.volume).toBe(1);
    expect(a.currentTime).toBe(30);
    // Il repart au prochain passage près de la fin.
    a.currentTime = 193;
    a.fire("timeupdate");
    r.timers.tick(1_000);
    expect(b.plays).toBe(2);
  });

  it("une pause pendant le fondu arrête les deux titres ; la reprise les relance ensemble", () => {
    const r = rig();
    const { a, b } = nearEnd(r);
    r.timers.tick(1_000);
    r.engine.pause();
    expect([a.paused, b.paused]).toEqual([true, true]);
    r.engine.resume();
    expect([a.paused, b.paused]).toEqual([false, false]);
  });

  it("un autre suivant avant la mi-fondu fait taire celui qui arrivait", () => {
    const r = rig();
    const { a, b } = nearEnd(r);
    r.timers.tick(1_000);
    b.currentTime = 1;
    r.timers.tick(10);
    r.engine.setNext(testTrack("t9", "C"), testSource("/z"));
    r.timers.tick(200);
    expect(b.src).toBe("");
    expect(a.volume).toBe(1);
    expect(r.elements.at(-1)?.src).toBe("/z");
  });

  it("le titre parti qui se tait avant la fin des courbes clôt le fondu", () => {
    const r = rig();
    const { a, b } = nearEnd(r);
    r.timers.tick(1_000);
    b.currentTime = 1;
    a.fire("ended");
    expect(advanced(r.events)).toHaveLength(1);
    expect(a.src).toBe("");
    expect(b.volume).toBe(1);
  });
});
