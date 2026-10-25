import { describe, expect, it } from "vitest";
import type { EngineEvent } from "@tentacle-tv/shared/music";
import { FakeElement, FakeTimers, testSource, testTrack } from "../engineTestKit";
import { HtmlAudioEngine } from "./htmlAudioEngine";

function rig() {
  const timers = new FakeTimers();
  const elements: FakeElement[] = [];
  const engine = new HtmlAudioEngine({
    createElement: () => {
      const el = new FakeElement();
      elements.push(el);
      return el;
    },
    resolveUrl: (url) => `http://srv${url}?api_key=tok`,
    credentials: null,
    canPlayType: (m) => (m.includes("flac") ? "probably" : ""),
    ...timers,
  });
  const events: EngineEvent[] = [];
  engine.subscribe((e) => events.push(e));
  return { engine, timers, elements, events };
}

describe("moteur <audio>", () => {
  it("dit honnêtement ce qu'il sait faire", () => {
    const { engine } = rig();
    expect(engine.capabilities).toEqual({ engine: "html", gapless: false, exclusiveOutput: false, replayGain: true, codecs: ["flac"], hotSwap: true });
  });

  it("joue, précharge le suivant, et le lance AVANT la fin du courant", async () => {
    const { engine, timers, elements, events } = rig();
    engine.play(testTrack("t1"), testSource("/a"), 0);
    const a = elements[0] as FakeElement;
    expect(a.src).toBe("http://srv/a?api_key=tok");
    expect(a.plays).toBe(1);
    engine.setNext(testTrack("t2"), testSource("/b"));
    const b = elements[1] as FakeElement;
    expect(b.preload).toBe("auto");
    expect(b.plays).toBe(0);
    a.loaded(10);
    a.currentTime = 9;
    a.fire("timeupdate");
    // 1 s restante, latence estimée 10 ms : départ à 990 ms.
    timers.tick(989);
    expect(b.plays).toBe(0);
    timers.tick(1);
    expect(b.plays).toBe(1);
    expect(events.filter((e) => e.type === "advanced")).toEqual([{ type: "advanced", fromKey: "t1", toKey: "t2" }]);
    expect(engine.getState().trackKey).toBe("t2");
    // L'ancien finit seul ses dernières millisecondes, puis il est libéré.
    expect(a.src).not.toBe("");
    a.fire("ended");
    expect(a.src).toBe("");
  });

  it("publie la position pendant la lecture : la barre suit le son dès la première seconde", () => {
    const { engine, elements, events } = rig();
    engine.play(testTrack("t1"), testSource("/a", "plugin", false), 0);
    const a = elements[0] as FakeElement;
    a.fire("playing");
    for (const t of [0.25, 0.5, 1.02]) {
      a.currentTime = t;
      a.fire("timeupdate");
    }
    const states = events.flatMap((e) => (e.type === "state" ? [e.state] : []));
    expect(states.at(-1)).toMatchObject({ status: "playing", trackKey: "t1", positionMs: 1020 });
    expect(states.map((s) => s.positionMs)).toEqual(expect.arrayContaining([250, 500, 1020]));
  });

  it("sans suivant, la fin est « ended »", () => {
    const { engine, elements } = rig();
    engine.play(testTrack("t1"), testSource("/a"), 0);
    (elements[0] as FakeElement).fire("ended");
    expect(engine.getState().status).toBe("ended");
  });

  it("démarre à la position demandée une fois la métadonnée connue", () => {
    const { engine, elements } = rig();
    engine.play(testTrack("t1"), testSource("/a"), 42_000);
    const a = elements[0] as FakeElement;
    expect(a.plays).toBe(0);
    a.loaded(200);
    expect(a.currentTime).toBe(42);
    expect(a.plays).toBe(1);
  });

  it("bascule en pause : la nouvelle source prend la place à la même position", () => {
    const { engine, elements, events } = rig();
    engine.play(testTrack("t1"), testSource("/cache", "plugin", false), 0);
    const a = elements[0] as FakeElement;
    a.loaded(200);
    a.currentTime = 33;
    engine.pause();
    engine.swapSource("t1", testSource("/lib"));
    const c = elements[1] as FakeElement;
    c.loaded(200);
    expect(c.currentTime).toBe(33);
    expect(a.src).toBe("");
    expect(events.at(-1)).toEqual({ type: "swapped", trackKey: "t1", origin: "library" });
    // La clé reste celle que le moteur connaissait (la correspondance jf:<id> est l'affaire de l'UI).
    expect(engine.getState().trackKey).toBe("t1");
  });

  it("bascule en lecture : placée devant, lancée au bon instant, fondue", () => {
    const { engine, timers, elements, events } = rig();
    engine.play(testTrack("t1"), testSource("/cache", "plugin", false), 0);
    const a = elements[0] as FakeElement;
    a.loaded(200);
    a.currentTime = 10;
    engine.swapSource("t1", testSource("/lib"));
    const c = elements[1] as FakeElement;
    c.loaded(200);
    expect(c.currentTime).toBeCloseTo(10.6, 6);
    c.fire("seeked");
    // 600 ms d'avance moins 30 ms de latence (un élément tout juste placé).
    timers.tick(570);
    expect(c.plays).toBe(1);
    c.fire("playing");
    timers.tick(100);
    expect(a.src).toBe("");
    expect(c.volume).toBeCloseTo(1, 6);
    expect(events.at(-1)).toEqual({ type: "swapped", trackKey: "t1", origin: "library" });
  });

  it("bascule du SUIVANT : il est rechargé depuis la nouvelle source", () => {
    const { engine, elements } = rig();
    engine.play(testTrack("t1"), testSource("/a"), 0);
    engine.setNext(testTrack("t2"), testSource("/cache2", "plugin"));
    engine.swapSource("t2", testSource("/lib2"));
    expect((elements[1] as FakeElement).src).toBe("");
    expect((elements[2] as FakeElement).src).toBe("http://srv/lib2?api_key=tok");
  });

  it("une bascule reçue d'avance sert le titre à son tour", () => {
    const { engine, elements } = rig();
    engine.swapSource("t9", testSource("/lib9"));
    engine.play(testTrack("t9"), testSource("/cache9", "plugin"), 0);
    expect((elements[0] as FakeElement).src).toBe("http://srv/lib9?api_key=tok");
  });

  it("refuse la sortie exclusive ; choisit la sortie de tous ses éléments", async () => {
    const { engine, elements } = rig();
    engine.play(testTrack("t1"), testSource("/a"), 0);
    await expect(engine.setOutput("x", true)).rejects.toThrow();
    await engine.setOutput("casque", false);
    expect((elements[0] as FakeElement).sinkId).toBe("casque");
  });
});
