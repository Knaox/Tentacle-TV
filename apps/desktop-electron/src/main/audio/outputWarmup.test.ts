import { describe, expect, it } from "vitest";
import { AudioQueue } from "./audioQueue";
import { warmOutput, warmupArgs } from "./outputWarmup";
import type { AudioBridgeSource } from "./audioBridgeContract";

const src: AudioBridgeSource = { url: "http://s/1", origin: "library", complete: true, sizeBytes: null, durationMs: null, replayGain: null, expiresAt: null };
const track = { trackKey: "t1", albumKey: null, durationMs: null, format: null };

describe("préchauffage de la sortie", () => {
  it("50 ms de silence numérique, en sourdine, qui ne gardent pas la sortie ouverte", () => {
    expect(warmupArgs()).toEqual(["loadfile", "av://lavfi:anullsrc=r=48000:cl=stereo", "replace", "-1", "end=0.05,mute=yes,keep-open=no"]);
  });

  it("occupe un identifiant mpv : le premier titre prend le suivant", async () => {
    const q = new AudioQueue();
    const sent: string[][] = [];
    const id = warmOutput({ command: (a) => (sent.push([...a]), Promise.resolve(null)) }, q);
    expect(id).toBe(1);
    const play = q.play(track, src, null).ops[0];
    expect(play?.op === "load" ? play.entry.mpvId : null).toBe(2);
    // Le départ du préchauffage n'est pas un titre : le modèle l'ignore.
    expect(q.startFile(1)).toBeNull();
    expect(q.startFile(2)?.notices).toEqual([]);
    expect(sent[0]?.[1]).toBe("av://lavfi:anullsrc=r=48000:cl=stereo");
  });

  it("refusé par mpv : l'identifiant est rendu, la suite reste juste", async () => {
    const q = new AudioQueue();
    warmOutput({ command: () => Promise.resolve("refus") }, q);
    const warn = console.warn;
    console.warn = () => undefined;
    await Promise.resolve();
    await Promise.resolve();
    console.warn = warn;
    const play = q.play(track, src, null).ops[0];
    expect(play?.op === "load" ? play.entry.mpvId : null).toBe(1);
  });
});
