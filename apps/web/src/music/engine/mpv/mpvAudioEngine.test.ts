import { beforeEach, describe, expect, it, vi } from "vitest";
import { testSource, testTrack } from "../engineTestKit";

const session = vi.hoisted(() => ({ published: false }));
vi.mock("../../../desktop/bridge", () => ({ supportsSystemMediaSession: () => session.published }));

const { createMpvAudioEngine } = await import("./mpvAudioEngine");

const auth = { baseUrl: "http://srv:3001", token: "tok", useCredentials: false };
const prefs = { volume: 1, muted: false, replayGain: "auto" as const, deviceId: null, exclusive: false };

function fakeBridge() {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const bridge = {
    invoke: <T,>(command: string, args?: Record<string, unknown>): Promise<T> => {
      calls.push([command, args]);
      const caps = { engine: "mpv", gapless: true, exclusiveOutput: true, replayGain: true, codecs: [], hotSwap: true };
      return Promise.resolve((command === "audio_engine_start" ? caps : undefined) as T);
    },
    listen: <T,>(_event: string, _h: (e: { payload: T }) => void) => Promise.resolve(() => undefined),
  };
  return { bridge, calls };
}

async function playedTrack(): Promise<Record<string, unknown>> {
  const f = fakeBridge();
  const engine = await createMpvAudioEngine(f.bridge, auth, prefs);
  engine.play({ ...testTrack("t1", "A"), artworkUrl: "/api/music/artwork/t1" }, testSource("/api/music/stream/1"), 0);
  const call = f.calls.find(([c]) => c === "audio_play");
  return (call?.[1]?.["track"] ?? {}) as Record<string, unknown>;
}

describe("la fiche du titre pour « À l'écoute »", () => {
  beforeEach(() => {
    session.published = false;
  });

  it("Electron (aucune session système déclarée) : le titre part sans fiche, comme avant", async () => {
    const track = await playedTrack();
    expect(track).not.toHaveProperty("meta");
  });

  it("une coquille qui publie « À l'écoute » (CEF) reçoit titre, artistes, album et pochette authentifiée", async () => {
    session.published = true;
    const track = await playedTrack();
    expect(track["meta"]).toEqual({
      title: expect.any(String),
      artist: expect.anything(),
      album: expect.anything(),
      artworkUrl: "http://srv:3001/api/music/artwork/t1?api_key=tok",
    });
  });
});
