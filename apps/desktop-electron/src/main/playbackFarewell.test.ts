import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_EXTRAPOLATION_MS, PlaybackFarewell, type FarewellStop, type SessionPost } from "./playbackFarewell";

/**
 * Le dernier mot à Jellyfin quand l'application se ferme en pleine lecture.
 * Ce qui se garde ici : la lecture ouverte est bien suivie d'un report à
 * l'autre, la position extrapolée ne s'emballe pas, et la sortie n'attend
 * jamais plus que son échéance — ni ne rejette.
 */

const BASE = { baseUrl: "https://jf.example", token: "jeton", authHeader: 'MediaBrowser Client="Tentacle TV"' };
const TICKS_PER_SECOND = 10_000_000;

function post(path: string, body: Record<string, unknown>): SessionPost {
  return { ...BASE, path, body: JSON.stringify(body) };
}

function start(playSessionId = "ps1", positionSeconds = 60): SessionPost {
  return post("/Sessions/Playing", {
    ItemId: "item1",
    MediaSourceId: "ms1",
    PlaySessionId: playSessionId,
    PositionTicks: positionSeconds * TICKS_PER_SECOND,
    IsPaused: false,
  });
}

function bodyOf(stop: FarewellStop | undefined): Record<string, unknown> {
  if (stop === undefined) throw new Error("aucun arrêt à poster");
  return JSON.parse(stop.body) as Record<string, unknown>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PlaybackFarewell — suivi des lectures relayées", () => {
  it("un début ouvre la lecture, un arrêt la referme", () => {
    const farewell = new PlaybackFarewell(() => 0);
    farewell.note(start());
    expect(farewell.pending()).toBe(true);
    farewell.note(post("/Sessions/Playing/Stopped", { ItemId: "item1", PlaySessionId: "ps1" }));
    expect(farewell.pending()).toBe(false);
  });

  it("un arrêt sans session de lecture ferme tout ce qui porte le média", () => {
    const farewell = new PlaybackFarewell(() => 0);
    farewell.note(start("ps1"));
    farewell.note(post("/Sessions/Playing/Stopped", { ItemId: "item1" }));
    expect(farewell.pending()).toBe(false);
  });

  it("une progression d'une lecture inconnue l'ouvre", () => {
    const farewell = new PlaybackFarewell(() => 0);
    farewell.note(post("/Sessions/Playing/Progress", { ItemId: "item2", PositionTicks: 5, IsPaused: true }));
    const [stop] = farewell.stops();
    expect(bodyOf(stop)).toEqual({ ItemId: "item2", MediaSourceId: "item2", PositionTicks: 5 });
  });

  it("un corps illisible ou sans média ne touche à rien", () => {
    const farewell = new PlaybackFarewell(() => 0);
    farewell.note({ ...BASE, path: "/Sessions/Playing", body: "{pas du json" });
    farewell.note(post("/Sessions/Playing", { PositionTicks: 12 }));
    expect(farewell.pending()).toBe(false);
  });

  it("la progression garde la route, le jeton et la source déjà connus", () => {
    const farewell = new PlaybackFarewell(() => 0);
    farewell.note(start());
    farewell.note(post("/Sessions/Playing/Progress", { ItemId: "item1", PlaySessionId: "ps1", PositionTicks: 7 }));
    const [stop] = farewell.stops();
    expect(stop?.baseUrl).toBe(BASE.baseUrl);
    expect(stop?.token).toBe(BASE.token);
    expect(bodyOf(stop)).toMatchObject({ MediaSourceId: "ms1", PlaySessionId: "ps1" });
  });
});

describe("PlaybackFarewell — position de l'arrêt", () => {
  it("extrapole depuis le dernier report quand la lecture tourne", () => {
    let now = 1_000;
    const farewell = new PlaybackFarewell(() => now);
    farewell.note(start("ps1", 60));
    now += 8_000;
    expect(bodyOf(farewell.stops()[0]).PositionTicks).toBe(68 * TICKS_PER_SECOND);
  });

  it("n'extrapole pas en pause", () => {
    let now = 0;
    const farewell = new PlaybackFarewell(() => now);
    farewell.note(post("/Sessions/Playing/Progress", { ItemId: "item1", PositionTicks: 42, IsPaused: true }));
    now += 20_000;
    expect(bodyOf(farewell.stops()[0]).PositionTicks).toBe(42);
  });

  it("plafonne l'extrapolation : une page muette ne fait pas avancer le film", () => {
    let now = 0;
    const farewell = new PlaybackFarewell(() => now);
    farewell.note(start("ps1", 0));
    now += 60 * 60_000;
    expect(bodyOf(farewell.stops()[0]).PositionTicks).toBe(MAX_EXTRAPOLATION_MS * 10_000);
  });
});

describe("PlaybackFarewell — la sortie", () => {
  it("poste l'arrêt de ce qui reste ouvert, puis n'a plus rien à dire", async () => {
    const farewell = new PlaybackFarewell(() => 0);
    farewell.note(start());
    const sent: FarewellStop[] = [];
    await farewell.farewell(async (stop) => {
      sent.push(stop);
    }, 1_500);
    expect(sent).toHaveLength(1);
    expect(bodyOf(sent[0])).toMatchObject({ ItemId: "item1", PlaySessionId: "ps1" });
    expect(farewell.pending()).toBe(false);
  });

  it("attend l'envoi en vol que la page vient de confier au relais", async () => {
    const farewell = new PlaybackFarewell(() => 0);
    let release: () => void = () => undefined;
    const inFlight = farewell.track(new Promise<void>((resolve) => {
      release = resolve;
    }));
    expect(farewell.pending()).toBe(true);
    let done = false;
    const exit = farewell.farewell(async () => undefined, 10_000).then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await inFlight;
    await exit;
    expect(done).toBe(true);
    expect(farewell.pending()).toBe(false);
  });

  it("n'attend jamais plus que l'échéance", async () => {
    vi.useFakeTimers();
    const farewell = new PlaybackFarewell(() => 0);
    farewell.note(start());
    let done = false;
    const exit = farewell.farewell(() => new Promise(() => undefined), 1_500).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(1_499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await exit;
    expect(done).toBe(true);
  });

  it("ne rejette pas quand l'envoi échoue ou lève", async () => {
    const farewell = new PlaybackFarewell(() => 0);
    farewell.note(start("ps1"));
    farewell.note(start("ps2"));
    let calls = 0;
    await expect(
      farewell.farewell((stop) => {
        calls += 1;
        if (bodyOf(stop).PlaySessionId === "ps1") throw new Error("réseau");
        return Promise.reject(new Error("503"));
      }, 1_500),
    ).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });
});
