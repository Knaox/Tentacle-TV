import { describe, expect, it } from "vitest";
import type { EngineEvent } from "@tentacle-tv/shared/music";
import { absoluteSourceUrl, albumKeyOf, elementSourceUrl, EngineEmitter, engineHeaders, extrapolatedPosition, idleState } from "./engineShared";
import { codecsFrom, crossfadeCurve, effectiveGainMode, elementVolume, nextLatencyEstimate, nextStartDelayMs, sourceGainDb } from "./html/htmlRules";
import { createMpvAudioEngine, type NativeBridge } from "./mpv/mpvAudioEngine";
import type { AudioBridgeEvent } from "./mpv/audioBridgeContract";
import { preferredEngine } from "./createAudioEngine";
import { testSource, testTrack } from "./engineTestKit";

const auth = { baseUrl: "http://srv:3001", token: "tok", useCredentials: false };
const prefs = { volume: 0.8, muted: false, replayGain: "auto" as const, deviceId: null, exclusive: false };

describe("adresses et authentification", () => {
  it("un chemin du serveur devient absolu ; une adresse complète reste telle quelle", () => {
    expect(absoluteSourceUrl("/api/music/stream/1", "http://srv:3001/")).toBe("http://srv:3001/api/music/stream/1");
    expect(absoluteSourceUrl("api/x", "http://srv")).toBe("http://srv/api/x");
    expect(absoluteSourceUrl("https://autre/x", "http://srv")).toBe("https://autre/x");
  });
  it("le moteur natif porte le jeton en en-tête ; un <audio> sans cookie le porte en api_key", () => {
    expect(engineHeaders(auth)).toEqual({ "X-Emby-Token": "tok" });
    expect(engineHeaders({ ...auth, token: null })).toEqual({});
    expect(elementSourceUrl("/api/music/stream/1", auth)).toBe("http://srv:3001/api/music/stream/1?api_key=tok");
    expect(elementSourceUrl("/a?b=1", auth)).toBe("http://srv:3001/a?b=1&api_key=tok");
    expect(elementSourceUrl("/api/music/stream/1", { ...auth, useCredentials: true })).toBe("http://srv:3001/api/music/stream/1");
  });
  it("le jeton ne part QUE vers le serveur Tentacle : jamais une pochette tierce, jamais googlevideo", () => {
    const leaks = (u: string) => u.includes("api_key");
    // Une adresse d'un autre hôte reste telle quelle, SANS le jeton.
    expect(elementSourceUrl("https://coverartarchive.org/release/x/front-250", auth)).toBe("https://coverartarchive.org/release/x/front-250");
    expect(leaks(elementSourceUrl("https://ia800.us.archive.org/x.jpg", auth))).toBe(false);
    expect(leaks(elementSourceUrl("https://rr3---sn-nfpnnjvh-1gir.googlevideo.com/videoplayback?expire=1&itag=251", auth))).toBe(false);
    // Même hôte, autre port ou autre schéma : une autre origine.
    expect(leaks(elementSourceUrl("http://srv:8096/Items/1/Images/Primary", auth))).toBe(false);
    expect(leaks(elementSourceUrl("https://srv:3001/api/music/stream/1", auth))).toBe(false);
    // Le serveur : son chemin, ou son adresse complète.
    expect(elementSourceUrl("/api/music/artwork/1", auth)).toBe("http://srv:3001/api/music/artwork/1?api_key=tok");
    expect(elementSourceUrl("http://srv:3001/api/plugins/sillon/music/stream/x", auth)).toBe("http://srv:3001/api/plugins/sillon/music/stream/x?api_key=tok");
    // Serveur de même origine que la page (base vide) : un chemin oui, une adresse sans schéma (« //hôte/… ») jamais.
    const same = { ...auth, baseUrl: "" };
    expect(elementSourceUrl("/api/music/stream/1", same)).toBe("/api/music/stream/1?api_key=tok");
    expect(leaks(elementSourceUrl("//evil.example/x.jpg", same))).toBe(false);
    expect(leaks(elementSourceUrl("https://coverartarchive.org/x", same))).toBe(false);
  });
  it("la clé d'album : Jellyfin, sinon MBID, sinon titre et artiste", () => {
    const t = testTrack("t1", "alb");
    expect(albumKeyOf(t)).toBe("alb");
    expect(albumKeyOf({ ...t, album: { title: "X", mbid: null, jellyfinId: null } })).toBe("X|Artiste");
    expect(albumKeyOf({ ...t, album: null })).toBeNull();
  });
  it("la position s'extrapole en lecture seulement, bornée par la durée", () => {
    const s = { ...idleState(1, false), status: "playing" as const, positionMs: 1000, durationMs: 1500 };
    expect(extrapolatedPosition(s, 0, 300)).toBe(1300);
    expect(extrapolatedPosition(s, 0, 9000)).toBe(1500);
    expect(extrapolatedPosition({ ...s, status: "paused" }, 0, 300)).toBe(1000);
  });
  it("un abonné qui lève ne prive pas les autres", () => {
    const e = new EngineEmitter();
    const got: string[] = [];
    e.subscribe(() => { throw new Error("x"); });
    e.subscribe((ev) => got.push(ev.type));
    const original = console.error;
    console.error = () => undefined;
    e.emit({ type: "needSource", trackKey: "k" });
    console.error = original;
    expect(got).toEqual(["needSource"]);
  });
});

describe("règles du moteur <audio>", () => {
  it("gain de la source, jamais positif, jamais d'écrêtage", () => {
    const s = { ...testSource("/x"), replayGain: { trackGainDb: -6, trackPeak: 0.5, albumGainDb: 3, albumPeak: null } };
    expect(sourceGainDb("track", s)).toBe(-6);
    expect(sourceGainDb("album", s)).toBe(0);
    expect(sourceGainDb("off", s)).toBe(0);
    expect(sourceGainDb("track", testSource("/x"))).toBe(0);
    expect(effectiveGainMode("auto", "A", ["A"])).toBe("album");
  });
  it("volume perceptuel (cubique, comme mpv) fois le gain", () => {
    expect(elementVolume(1, 0)).toBe(1);
    expect(elementVolume(0.5, 0)).toBeCloseTo(0.125, 6);
    expect(elementVolume(1, -6)).toBeCloseTo(10 ** (-6 / 20), 6);
  });
  it("le suivant part avant la fin, de la latence mesurée", () => {
    expect(nextStartDelayMs(0.5, 60)).toBe(440);
    expect(nextStartDelayMs(0.02, 60)).toBe(0);
    expect(nextLatencyEstimate(60, 160)).toBe(90);
    expect(nextLatencyEstimate(60, 5000)).toBe(117);
  });
  it("codecs : ce que le navigateur dit lire, jamais le DSD", () => {
    const chrome = (m: string) => (/flac|opus|mpeg|mp4a|wav/.test(m) ? "probably" : "");
    expect(codecsFrom(chrome)).toEqual(["flac", "wav", "opus", "aac", "mp3"]);
  });
  it("le fondu garde la puissance constante", () => {
    for (const p of crossfadeCurve(8)) expect(p.out ** 2 + p.in ** 2).toBeCloseTo(1, 9);
  });
  it("le moteur natif seulement si la coquille le déclare", () => {
    expect(preferredEngine(true)).toBe("mpv");
    expect(preferredEngine(false)).toBe("html");
  });
});

function fakeBridge() {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  let handler: ((e: { payload: AudioBridgeEvent }) => void) | null = null;
  let unlistened = false;
  const bridge: NativeBridge = {
    invoke: <T,>(command: string, args?: Record<string, unknown>) => {
      calls.push([command, args]);
      if (command === "audio_engine_start") {
        return Promise.resolve({ engine: "mpv", gapless: true, exclusiveOutput: true, replayGain: true, codecs: ["flac"], hotSwap: true } as T);
      }
      return Promise.resolve(undefined as T);
    },
    listen: <T,>(_event: string, h: (e: { payload: T }) => void) => {
      handler = h as unknown as (e: { payload: AudioBridgeEvent }) => void;
      return Promise.resolve(() => { unlistened = true; });
    },
  };
  return { bridge, calls, push: (e: AudioBridgeEvent) => handler?.({ payload: e }), unlistened: () => unlistened };
}

describe("adaptateur du moteur natif", () => {
  it("démarre avec l'origine du serveur et l'en-tête du jeton", async () => {
    const f = fakeBridge();
    const engine = await createMpvAudioEngine(f.bridge, auth, prefs);
    expect(f.calls[0]).toEqual(["audio_engine_start", { serverOrigin: "http://srv:3001", headers: { "X-Emby-Token": "tok" }, ...prefs }]);
    expect(engine.capabilities.gapless).toBe(true);
  });

  it("la barre se met à jour AVANT le son ; la source part en adresse absolue", async () => {
    const f = fakeBridge();
    const engine = await createMpvAudioEngine(f.bridge, auth, prefs);
    const seen: EngineEvent[] = [];
    engine.subscribe((e) => seen.push(e));
    engine.play(testTrack("t1"), testSource("/api/music/stream/1"), 5000);
    expect(seen[0]).toMatchObject({ type: "state", state: { status: "loading", trackKey: "t1", positionMs: 5000, durationMs: 200_000 } });
    const [command, args] = f.calls[1] ?? [];
    expect(command).toBe("audio_play");
    expect(args).toMatchObject({ startMs: 5000, track: { trackKey: "t1", albumKey: "A" }, source: { url: "http://srv:3001/api/music/stream/1" } });
  });

  it("relaie les évènements du principal et extrapole la position", async () => {
    const f = fakeBridge();
    const engine = await createMpvAudioEngine(f.bridge, auth, prefs);
    const seen: string[] = [];
    engine.subscribe((e) => seen.push(e.type));
    f.push({ type: "advanced", fromKey: "t1", toKey: "t2" });
    f.push({ type: "state", state: { ...idleState(1, false), status: "playing", trackKey: "t2", positionMs: 1000, durationMs: 9000 }, at: Date.now() - 500 });
    expect(seen).toEqual(["advanced", "state"]);
    expect(engine.getState().positionMs).toBeGreaterThanOrEqual(1500);
  });

  it("arrêt : désabonné, et l'instance native est rendue", async () => {
    const f = fakeBridge();
    const engine = await createMpvAudioEngine(f.bridge, auth, prefs);
    engine.dispose();
    expect(f.unlistened()).toBe(true);
    expect(f.calls.at(-1)?.[0]).toBe("audio_engine_stop");
  });
});
