import { describe, expect, it } from "vitest";
import type { EngineEvent } from "@tentacle-tv/shared/music";
import { FakeElement, FakeTimers, testSource, testTrack } from "../engineTestKit";
import { HtmlAudioEngine } from "./htmlAudioEngine";

/** Un titre interrompu en plein milieu se reprend plus loin, au lieu de l'erreur ou du titre suivant. */

function rig() {
  const timers = new FakeTimers();
  const elements: FakeElement[] = [];
  const engine = new HtmlAudioEngine({
    createElement: () => {
      const el = new FakeElement();
      elements.push(el);
      return el;
    },
    resolveUrl: (url) => `http://srv${url}`,
    credentials: null,
    canPlayType: () => "probably",
    ...timers,
  });
  const events: EngineEvent[] = [];
  engine.subscribe((e) => events.push(e));
  return { engine, elements, events };
}

/** Le dernier élément créé, sa métadonnée chargée. */
function lastLoaded(elements: FakeElement[]): FakeElement {
  const el = elements.at(-1) as FakeElement;
  el.loaded(200);
  return el;
}

describe("moteur <audio> — reprise en plein titre", () => {
  it("une trame illisible : la même source repart à la position, sans erreur", () => {
    const { engine, elements, events } = rig();
    engine.play(testTrack("t1"), testSource("/a"), 0);
    const a = lastLoaded(elements);
    a.currentTime = 16.8;
    a.fire("timeupdate");
    a.fire("error");
    const b = lastLoaded(elements);
    expect(b).not.toBe(a);
    expect(b.src).toBe("http://srv/a");
    expect(b.currentTime).toBeCloseTo(16.8);
    expect(b.plays).toBe(1);
    expect(engine.getState().status).not.toBe("error");
    expect(events.some((e) => e.type === "state" && e.state.status === "error")).toBe(false);
  });

  it("le défaut revient au même endroit : la reprise saute au-delà, puis l'erreur au bout de trois", () => {
    const { engine, elements } = rig();
    engine.play(testTrack("t1"), testSource("/a"), 0);
    const a = lastLoaded(elements);
    a.currentTime = 16.8;
    a.fire("timeupdate");
    a.fire("error");
    const b = lastLoaded(elements);
    b.fire("error");
    const c = lastLoaded(elements);
    expect(c.currentTime).toBeCloseTo(17.8);
    c.fire("error");
    const d = lastLoaded(elements);
    expect(d.currentTime).toBeCloseTo(23.8);
    d.fire("error");
    expect(engine.getState().status).toBe("error");
  });

  it("une fin prématurée (flux rompu) reprend à la position au lieu de passer au suivant", () => {
    const { engine, elements, events } = rig();
    engine.play(testTrack("t1"), testSource("/a"), 0);
    const a = lastLoaded(elements);
    engine.setNext(testTrack("t2"), testSource("/b"));
    a.currentTime = 40;
    a.fire("timeupdate");
    a.fire("ended");
    expect(events.some((e) => e.type === "advanced")).toBe(false);
    const fresh = lastLoaded(elements);
    expect(fresh.src).toBe("http://srv/a");
    expect(fresh.currentTime).toBeCloseTo(40);
  });

  it("la vraie fin enchaîne comme avant", () => {
    const { engine, elements, events } = rig();
    engine.play(testTrack("t1"), testSource("/a"), 0);
    const a = lastLoaded(elements);
    a.currentTime = 199.5;
    a.fire("timeupdate");
    a.fire("ended");
    expect(engine.getState().status).toBe("ended");
    expect(events.some((e) => e.type === "state" && e.state.status === "buffering")).toBe(false);
  });
});
