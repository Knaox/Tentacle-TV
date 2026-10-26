import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioBridgeControl, AudioBridgeEvent, AudioBridgeSource, AudioBridgeTrack } from "./audioBridgeContract";
import type { DeckTimeline, FadedSource } from "./crossfadeFilter";
import { CrossfadeDecks } from "./crossfadeDecks";

/** Une fausse instance : elle note ce qu'on lui demande ; sa chronologie se règle à la main. */
const fakes = vi.hoisted(() => {
  const made: FakeDeck[] = [];
  class FakeDeck {
    calls: Array<[string, ...unknown[]]> = [];
    tl: DeckTimeline = { positionS: 0, offsetS: 0, durationS: 200, complete: true, playing: false, loaded: false, ended: false };
    constructor(_config: unknown, readonly emit: (e: AudioBridgeEvent) => void) {
      made.push(this);
    }
    start = async () => ({ engine: "mpv", gapless: true, exclusiveOutput: true, replayGain: true, codecs: [], hotSwap: true });
    play = (...a: unknown[]) => void this.calls.push(["play", ...a]);
    setNext = (...a: unknown[]) => void this.calls.push(["setNext", ...a]);
    control = (c: AudioBridgeControl) => void this.calls.push(["control", c]);
    setGain = (e: string) => void this.calls.push(["setGain", e]);
    setChain = (e: string | null) => void this.calls.push(["setChain", e]);
    swap = (...a: unknown[]) => void this.calls.push(["swap", ...a]);
    setOutput = async (...a: unknown[]) => void this.calls.push(["setOutput", ...a]);
    dispose = async () => void this.calls.push(["dispose"]);
    timeline = () => this.tl;
    sourceCut = () => undefined;
    level = async () => null;
    readProperty = async () => null;
    listOutputs = async () => [];
    named = (name: string) => this.calls.filter((c) => c[0] === name);
    state(trackKey: string, status = "playing"): void {
      this.emit({ type: "state", at: 0, state: { status, trackKey, positionMs: 0, durationMs: 200_000, volume: 1, muted: false, format: null, output: { deviceId: null, exclusive: false }, error: null } } as AudioBridgeEvent);
    }
  }
  return { made, FakeDeck };
});
vi.mock("./audioEngine", () => ({ NativeAudioEngine: fakes.FakeDeck }));

type Fake = InstanceType<typeof fakes.FakeDeck>;

const track = (key: string): AudioBridgeTrack => ({ trackKey: key, albumKey: key.toUpperCase(), durationMs: 200_000, format: null });
const source = (key: string): AudioBridgeSource => ({ url: `http://s/${key}`, origin: "library", complete: true, sizeBytes: null, durationMs: 200_000, replayGain: null, expiresAt: null });
const START = { serverOrigin: "http://s", headers: {}, volume: 1, muted: false, replayGain: "off" as const, deviceId: null, exclusive: false };

async function rig(crossfadeMs = 6000) {
  const events: AudioBridgeEvent[] = [];
  const decks = new CrossfadeDecks({ platform: "linux" }, (e) => events.push(e));
  await decks.start(START);
  decks.control({ action: "crossfade", value: crossfadeMs });
  await vi.advanceTimersByTimeAsync(0);
  const [a, b] = fakes.made as [Fake, Fake | undefined];
  return { decks, events, a, b };
}

/** A joue t1 ; t2 est donné à fondre ; A arrive près de sa fin, B est chargé. */
async function nearEnd(fadeMs = 6000) {
  const r = await rig();
  r.decks.play(track("t1"), source("t1"), 0);
  r.a.tl = { ...r.a.tl, playing: true, loaded: true, positionS: 10 };
  r.decks.setNext(track("t2"), source("t2"), fadeMs);
  r.b!.tl = { ...r.b!.tl, loaded: true };
  r.a.tl = { ...r.a.tl, positionS: 192.5 };
  r.a.state("t1");
  return r;
}

beforeEach(() => {
  fakes.made.length = 0;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("transition douce du bureau — deux instances", () => {
  it("coupée : une seule instance, le suivant dans sa liste (enchaînement d'avant)", async () => {
    const r = await rig(0);
    expect(fakes.made).toHaveLength(1);
    r.decks.setNext(track("t2"), source("t2"), 6000);
    expect(r.a.named("setNext")).toEqual([["setNext", track("t2"), source("t2")]]);
  });

  it("allumée : la réserve naît, porte le gain du fondu, et charge EN PAUSE le suivant avec sa courbe d'entrée", async () => {
    const r = await nearEnd();
    expect(r.b?.named("setChain")).toEqual([["setChain", "1"]]);
    expect(r.a.named("setNext").at(-1)).toEqual(["setNext", null, null]);
    const [, t, s, start, paused] = r.b!.named("play")[0] as [string, AudioBridgeTrack, FadedSource, number, boolean];
    expect([t.trackKey, s.fadeInS, start, paused]).toEqual(["t2", 6, 0, true]);
  });

  it("arme la courbe de sortie, lance le suivant, passe devant à mi-fondu, arrête l'ancienne au bout", async () => {
    const r = await nearEnd();
    expect(r.a.named("setGain").at(-1)?.[1]).toContain("cos(PI/2*(t-194.000000)/6.000000)");
    const resumes = () => r.b!.named("control").filter((c) => (c[1] as AudioBridgeControl).action === "resume");
    await vi.advanceTimersByTimeAsync(1469);
    expect(resumes()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(resumes()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2999);
    expect(r.events.filter((e) => e.type === "advanced")).toEqual([]);
    r.b!.state("t2");
    expect(r.events.filter((e) => e.type === "state").length).toBe(1); // la réserve se tait avant la mi-fondu
    await vi.advanceTimersByTimeAsync(1);
    expect(r.events.filter((e) => e.type === "advanced")).toEqual([{ type: "advanced", fromKey: "t1", toKey: "t2" }]);
    const before = r.events.length;
    r.a.state("t1");
    r.b!.state("t2");
    expect(r.events.slice(before).map((e) => e.type === "state" && e.state.trackKey)).toEqual(["t2"]);
    await vi.advanceTimersByTimeAsync(3500);
    expect(r.a.named("control").at(-1)).toEqual(["control", { action: "stop" }]);
  });

  it("une pause gèle le fondu : les deux instances s'arrêtent, les minuteries aussi", async () => {
    const r = await nearEnd();
    await vi.advanceTimersByTimeAsync(1470 + 1000);
    r.decks.control({ action: "pause" });
    expect(r.b!.named("control").at(-1)).toEqual(["control", { action: "pause" }]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(r.events.filter((e) => e.type === "advanced")).toEqual([]);
    r.decks.control({ action: "resume" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(r.events.filter((e) => e.type === "advanced")).toHaveLength(1);
  });

  it("le même album dans l'ordre (aucun fondu décidé par la page) : la liste de l'instance, sans blanc", async () => {
    const r = await rig();
    r.decks.play(track("t1"), source("t1"), 0);
    r.decks.setNext(track("t2"), source("t2"), 0);
    expect(r.a.named("setNext").at(-1)).toEqual(["setNext", track("t2"), source("t2")]);
    expect(r.b!.named("play")).toEqual([]);
  });

  it("allumée en pleine écoute : le titre qui joue n'a pas le gain du fondu, son suivant s'enchaîne comme avant", async () => {
    const r = await rig(0);
    r.decks.play(track("t1"), source("t1"), 0);
    r.decks.control({ action: "crossfade", value: 6000 });
    await vi.advanceTimersByTimeAsync(0);
    r.decks.setNext(track("t2"), source("t2"), 6000);
    expect(r.a.named("setNext").at(-1)).toEqual(["setNext", track("t2"), source("t2")]);
    // Le titre suivant (lancé sur une instance qui porte le gain), lui, fondra.
    r.decks.play(track("t3"), source("t3"), 0);
    r.decks.setNext(track("t4"), source("t4"), 6000);
    expect(fakes.made[1]?.named("play").at(-1)?.[1]).toEqual(track("t4"));
  });

  it("trop tard pour fondre (un saut tout près de la fin) : le suivant rend à l'enchaînement d'avant", async () => {
    const r = await rig();
    r.decks.play(track("t1"), source("t1"), 0);
    r.decks.setNext(track("t2"), source("t2"), 6000);
    r.b!.tl = { ...r.b!.tl, loaded: true };
    r.a.tl = { ...r.a.tl, playing: true, loaded: true, positionS: 193.9 };
    r.a.state("t1");
    expect(r.a.named("setNext").at(-1)).toEqual(["setNext", track("t2"), source("t2")]);
    expect(r.b!.named("control").at(-1)).toEqual(["control", { action: "stop" }]);
  });

  it("un geste : le titre quitté sort en 150 ms sur son instance, le nouveau part sur l'autre", async () => {
    const r = await rig();
    r.decks.play(track("t1"), source("t1"), 0);
    r.a.tl = { ...r.a.tl, playing: true, loaded: true };
    r.decks.play(track("t3"), source("t3"), 0);
    expect(r.b!.named("play").at(-1)?.[1]).toEqual(track("t3"));
    await vi.advanceTimersByTimeAsync(160);
    const gains = r.a.named("setGain").map((c) => Number(c[1]));
    expect(gains).toHaveLength(15);
    expect(gains.at(-1)).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(r.a.named("control").at(-1)).toEqual(["control", { action: "stop" }]);
  });

  it("après un geste, le suivant d'après attend la fin de la sortie courte pour se charger sur la réserve (recette M6, défaut 2)", async () => {
    const r = await rig();
    r.decks.play(track("t1"), source("t1"), 0);
    r.a.tl = { ...r.a.tl, playing: true, loaded: true };
    r.decks.play(track("t3"), source("t3"), 0);
    // Le nouveau titre sonne : le contrôleur donne aussitôt son suivant, à fondre.
    r.decks.setNext(track("t4"), source("t4"), 6000);
    expect(r.a.named("play")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(160);
    expect(r.a.named("setGain").map((c) => Number(c[1])).at(-1)).toBe(0);
    expect(r.a.named("play")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(r.a.named("control").at(-1)).toEqual(["control", { action: "stop" }]);
    const [, t, s, , paused] = r.a.named("play").at(-1) as [string, AudioBridgeTrack, FadedSource, number, boolean];
    expect([t.trackKey, s.fadeInS, paused]).toEqual(["t4", 6, true]);
  });

  it("un saut dans la courbe d'entrée d'un titre entré en fondu le relit à la cible, sans elle", async () => {
    const r = await nearEnd();
    await vi.advanceTimersByTimeAsync(1470 + 3000 + 3500);
    r.decks.control({ action: "seek", value: 2_000 });
    const [, t, s, start] = r.b!.named("play").at(-1) as [string, AudioBridgeTrack, FadedSource, number];
    expect([t.trackKey, s.fadeInS, start]).toEqual(["t2", undefined, 2_000]);
    r.decks.control({ action: "seek", value: 30_000 });
    expect(r.b!.named("control").at(-1)).toEqual(["control", { action: "seek", value: 30_000 }]);
  });

  it("une bascule de source pendant le fondu attend sa fin", async () => {
    const r = await nearEnd();
    await vi.advanceTimersByTimeAsync(1470 + 1000);
    r.decks.swap("t2", source("t2-lib"));
    expect(r.b!.named("swap")).toEqual([]);
    await vi.advanceTimersByTimeAsync(5500);
    expect(r.b!.named("swap")).toEqual([["swap", "t2", source("t2-lib")]]);
  });

  it("le mode exclusif écarte la réserve (une sortie exclusive n'a qu'un flux)", async () => {
    const r = await rig();
    await r.decks.setOutput(null, true);
    expect(r.b!.named("dispose")).toHaveLength(1);
    r.decks.setNext(track("t2"), source("t2"), 6000);
    expect(r.a.named("setNext").at(-1)).toEqual(["setNext", track("t2"), source("t2")]);
  });
});
