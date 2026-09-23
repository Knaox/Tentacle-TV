import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JellyfinCaller } from "./jellyfinCalls";
import type { PlaybackStateDto } from "./protocolMessages";
import {
  EDGE_COALESCE_MS,
  HEARTBEAT_MS,
  MAX_EXTRAPOLATION_MS,
  PlaybackReporter,
  TRANSCODE_PING_MS,
} from "./playbackReporter";

/**
 * La politique de report : Jellyfin ne reçoit que ce qui change quelque chose
 * (début, fin, bords regroupés), plus le signe de vie qu'il exige et le ping
 * d'un transcodage en pause — et jamais un report APRÈS l'arrêt.
 */

interface Call {
  path: string;
  body: Record<string, unknown> | undefined;
}

function recorder() {
  const calls: Call[] = [];
  let release: (() => void) | null = null;
  let hold = false;
  const caller: JellyfinCaller = {
    post: (path, body) => {
      calls.push({ path, body: body as Record<string, unknown> | undefined });
      if (!hold) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        release = () => resolve(true);
      });
    },
  };
  return {
    caller,
    calls,
    paths: () => calls.map((c) => c.path),
    holdNext: () => { hold = true; },
    releaseHeld: () => { hold = false; release?.(); },
  };
}

const TICKS_PER_SECOND = 10_000_000;

function state(overrides: Partial<PlaybackStateDto> = {}): PlaybackStateDto {
  return {
    itemId: "item1",
    mediaSourceId: "ms1",
    playSessionId: "ps1",
    playMethod: "DirectPlay",
    positionTicks: 60 * TICKS_PER_SECOND,
    isPaused: false,
    ...overrides,
  };
}

let now = 0;
beforeEach(() => {
  vi.useFakeTimers();
  now = 1_000_000;
});
afterEach(() => {
  vi.useRealTimers();
});

function reporter() {
  const rec = recorder();
  return { rec, r: new PlaybackReporter(rec.caller, () => now) };
}

async function advance(ms: number): Promise<void> {
  now += ms;
  await vi.advanceTimersByTimeAsync(ms);
}

describe("PlaybackReporter — début et fin", () => {
  it("annonce le début avec l'état complet", async () => {
    const { rec, r } = reporter();
    await r.start(state({ audioStreamIndex: 1 }));
    expect(rec.paths()).toEqual(["/Sessions/Playing"]);
    expect(rec.calls[0]?.body).toMatchObject({
      ItemId: "item1", MediaSourceId: "ms1", PlaySessionId: "ps1", PlayMethod: "DirectPlay",
      PositionTicks: 60 * TICKS_PER_SECOND, IsPaused: false, AudioStreamIndex: 1, SubtitleStreamIndex: -1,
    });
  });

  it("une reprise rattache sans annoncer un nouveau début", async () => {
    const { rec, r } = reporter();
    await r.start(state(), true);
    expect(rec.paths()).toEqual(["/Sessions/Playing/Progress"]);
  });

  it("la même lecture réannoncée est adoptée sans rien envoyer", async () => {
    const { rec, r } = reporter();
    await r.start(state());
    await r.start(state({ positionTicks: 70 * TICKS_PER_SECOND }), true);
    expect(rec.paths()).toEqual(["/Sessions/Playing"]);
  });

  it("un autre média arrête d'abord le précédent", async () => {
    const { rec, r } = reporter();
    await r.start(state());
    await r.start(state({ itemId: "item2", playSessionId: "ps2" }));
    expect(rec.paths()).toEqual(["/Sessions/Playing", "/Sessions/Playing/Stopped", "/Sessions/Playing"]);
  });

  it("l'arrêt porte la position finale, puis plus rien ne part", async () => {
    const { rec, r } = reporter();
    await r.start(state());
    await expect(r.stop(state({ positionTicks: 90 * TICKS_PER_SECOND }))).resolves.toBe(true);
    expect(rec.calls.at(-1)).toEqual({
      path: "/Sessions/Playing/Stopped",
      body: { ItemId: "item1", MediaSourceId: "ms1", PlaySessionId: "ps1", PositionTicks: 90 * TICKS_PER_SECOND },
    });
    await advance(HEARTBEAT_MS * 2);
    expect(rec.paths()).toEqual(["/Sessions/Playing", "/Sessions/Playing/Stopped"]);
    expect(r.isActive()).toBe(false);
    await expect(r.stop()).resolves.toBe(true);
    expect(rec.calls).toHaveLength(2);
  });

  it("un report qui traîne ne peut pas arriver après l'arrêt", async () => {
    const { rec, r } = reporter();
    await r.start(state());
    rec.holdNext();
    r.progress("pause", state({ isPaused: true }));
    await advance(EDGE_COALESCE_MS);
    const stopped = r.stop();
    expect(rec.paths()).toEqual(["/Sessions/Playing", "/Sessions/Playing/Progress"]);
    rec.releaseHeld();
    await stopped;
    expect(rec.paths()).toEqual(["/Sessions/Playing", "/Sessions/Playing/Progress", "/Sessions/Playing/Stopped"]);
  });
});

describe("PlaybackReporter — ce qui mérite une requête", () => {
  it("un battement ne coûte rien à Jellyfin", async () => {
    const { rec, r } = reporter();
    await r.start(state());
    r.progress("tick", state({ positionTicks: 70 * TICKS_PER_SECOND }));
    await advance(30_000);
    expect(rec.paths()).toEqual(["/Sessions/Playing"]);
  });

  it("une rafale de sauts part en un seul report, à la dernière position", async () => {
    const { rec, r } = reporter();
    await r.start(state());
    for (let i = 1; i <= 10; i++) r.progress("seek", state({ positionTicks: i * 100 * TICKS_PER_SECOND }));
    await advance(EDGE_COALESCE_MS);
    expect(rec.paths()).toEqual(["/Sessions/Playing", "/Sessions/Playing/Progress"]);
    // La lecture tourne pendant le regroupement : la position a avancé d'autant.
    expect(rec.calls[1]?.body?.PositionTicks).toBe(1_000 * TICKS_PER_SECOND + EDGE_COALESCE_MS * 10_000);
  });

  it("le signe de vie part toutes les quatre minutes, pause comprise", async () => {
    const { rec, r } = reporter();
    await r.start(state({ isPaused: true }));
    await advance(HEARTBEAT_MS - 1);
    expect(rec.paths()).toEqual(["/Sessions/Playing"]);
    await advance(1);
    await advance(HEARTBEAT_MS);
    expect(rec.paths()).toEqual(["/Sessions/Playing", "/Sessions/Playing/Progress", "/Sessions/Playing/Progress"]);
  });

  it("un bord repousse le signe de vie", async () => {
    const { rec, r } = reporter();
    await r.start(state());
    await advance(HEARTBEAT_MS - 10_000);
    r.progress("pause", state({ isPaused: true }));
    await advance(EDGE_COALESCE_MS);
    await advance(HEARTBEAT_MS - 1_000);
    expect(rec.paths()).toEqual(["/Sessions/Playing", "/Sessions/Playing/Progress"]);
  });

  it("en pause sur un flux transcodé, le transcodage est pingé ; pas en lecture directe", async () => {
    const { rec, r } = reporter();
    await r.start(state({ playMethod: "Transcode" }));
    r.progress("pause", state({ playMethod: "Transcode", isPaused: true }));
    await advance(TRANSCODE_PING_MS * 2);
    const pings = rec.paths().filter((p) => p.startsWith("/Sessions/Playing/Ping"));
    expect(pings).toEqual(["/Sessions/Playing/Ping?playSessionId=ps1", "/Sessions/Playing/Ping?playSessionId=ps1"]);
    r.progress("unpause", state({ playMethod: "Transcode" }));
    await advance(TRANSCODE_PING_MS * 2);
    expect(rec.paths().filter((p) => p.startsWith("/Sessions/Playing/Ping"))).toHaveLength(2);

    const direct = reporter();
    await direct.r.start(state({ isPaused: true }));
    await advance(TRANSCODE_PING_MS * 2);
    expect(direct.rec.paths().some((p) => p.startsWith("/Sessions/Playing/Ping"))).toBe(false);
  });

  it("un report sans début connu rattache la lecture", async () => {
    const { rec, r } = reporter();
    r.progress("tick", state());
    await advance(0);
    expect(rec.paths()).toEqual(["/Sessions/Playing/Progress"]);
    expect(r.isActive()).toBe(true);
  });

  it("resync redit l'état à un Jellyfin qui a pu l'oublier", async () => {
    const { rec, r } = reporter();
    await r.start(state());
    r.resync();
    await advance(0);
    expect(rec.paths()).toEqual(["/Sessions/Playing", "/Sessions/Playing/Progress"]);
  });
});

describe("PlaybackReporter — position", () => {
  it("extrapole depuis le dernier message en lecture, plafonnée", async () => {
    const { r } = reporter();
    await r.start(state({ positionTicks: 0 }));
    now += 8_000;
    expect(r.current()?.positionTicks).toBe(8 * TICKS_PER_SECOND);
    now += 60 * 60_000;
    expect(r.current()?.positionTicks).toBe(MAX_EXTRAPOLATION_MS * 10_000);
  });

  it("n'extrapole pas en pause", async () => {
    const { r } = reporter();
    await r.start(state({ isPaused: true, positionTicks: 42 }));
    now += 50_000;
    expect(r.current()?.positionTicks).toBe(42);
  });
});
