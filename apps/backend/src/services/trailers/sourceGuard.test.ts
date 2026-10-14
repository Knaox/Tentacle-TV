/**
 * Les garde-fous des sources — YouTube (lectures), Dailymotion, et leur état
 * qui survit au redémarrage. L'horloge est passée en argument.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stored = new Map<string, string>();
vi.mock("../configStore", () => ({
  getConfigValue: (key: string) => stored.get(key),
  setConfigValue: async (key: string, value: string) => void stored.set(key, value),
}));

import {
  DAILYMOTION_API_PER_HOUR, dailymotionGuardStatus, recordDailymotionResponse, resetDailymotionGuard, takeDailymotionSlot,
} from "./dailymotionGuard";
import { GUARD_STATE_KEY, restoreGuardState, saveGuardState, stopGuardState } from "./guardState";
import {
  PLAYBACK_EXTRACTIONS_PER_HOUR, previewRefusal, recordYouTubeSuccess, resetYouTubeGuard, takeYouTubePlayback, tripYouTubeBreaker,
  youtubeGuardStatus,
} from "./youtubeGuard";

const MIN = 60_000;

beforeEach(() => {
  resetYouTubeGuard();
  resetDailymotionGuard();
  stored.clear();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  stopGuardState();
  vi.restoreAllMocks();
});

describe("YouTube › les lectures", () => {
  it("par compte : 10 d'avance, puis une par minute", () => {
    for (let i = 0; i < 10; i++) expect(takeYouTubePlayback("a", 0)).toBeNull();
    expect(takeYouTubePlayback("a", 0)).toEqual({ kind: "account", retryAfterMs: MIN });
    expect(takeYouTubePlayback("b", 0)).toBeNull();
    expect(takeYouTubePlayback("a", MIN)).toBeNull();
  });

  it("60 par heure pour tout le serveur", () => {
    for (let i = 0; i < PLAYBACK_EXTRACTIONS_PER_HOUR; i++) expect(takeYouTubePlayback(`u${i}`, i * 1000)).toBeNull();
    expect(takeYouTubePlayback("other", 61_000)?.kind).toBe("budget");
    expect(takeYouTubePlayback("other", 60 * MIN)).toBeNull();
  });

  it("disjoncteur ouvert : une lecture-sonde toutes les 5 min, qui le referme si YouTube répond", () => {
    tripYouTubeBreaker("bot", 0);
    expect(takeYouTubePlayback("a", 1000)).toBeNull();
    expect(takeYouTubePlayback("a", 2000)?.kind).toBe("blocked");
    expect(takeYouTubePlayback("a", 4 * MIN)?.kind).toBe("blocked");
    expect(takeYouTubePlayback("a", 5 * MIN + 1000)).toBeNull();
    // La sonde a réussi : tout repart.
    recordYouTubeSuccess(5 * MIN + 2000);
    expect(previewRefusal(5 * MIN + 2000)).toBeNull();
    expect(youtubeGuardStatus(5 * MIN + 2000)).toEqual({ state: "normal" });
  });

  it("l'état pour l'administration : en pause jusqu'à, et pourquoi", () => {
    tripYouTubeBreaker("bot", 0);
    expect(youtubeGuardStatus(MIN)).toEqual({ state: "paused", until: 30 * MIN, reason: "bot" });
  });
});

describe("Dailymotion", () => {
  it("l'API : 5 appels d'avance, puis un toutes les 2 s", () => {
    for (let i = 0; i < 5; i++) expect(takeDailymotionSlot("api", "interactive", 0)).toBe(0);
    expect(takeDailymotionSlot("api", "interactive", 0)).toBe(2000);
    expect(takeDailymotionSlot("api", "interactive", 2000)).toBe(0);
  });

  it("l'API : 300 par heure au plus", () => {
    let now = 0;
    for (let i = 0; i < DAILYMOTION_API_PER_HOUR; i++, now += 2000) expect(takeDailymotionSlot("api", "interactive", now)).toBe(0);
    expect(takeDailymotionSlot("api", "interactive", now)).toBeGreaterThan(0);
  });

  it("les flux : deux par seconde", () => {
    expect(takeDailymotionSlot("stream", "interactive", 0)).toBe(0);
    expect(takeDailymotionSlot("stream", "interactive", 0)).toBe(0);
    expect(takeDailymotionSlot("stream", "interactive", 0)).toBe(500);
  });

  it("la préparation a ses seaux : elle ne prend jamais la place d'un appel attendu", () => {
    for (let i = 0; i < 3; i++) expect(takeDailymotionSlot("api", "prefetch", 0)).toBe(0);
    expect(takeDailymotionSlot("api", "prefetch", 0)).toBe(1000);
    for (let i = 0; i < 5; i++) expect(takeDailymotionSlot("api", "interactive", 0)).toBe(0);
    for (let i = 0; i < 3; i++) expect(takeDailymotionSlot("stream", "prefetch", 0)).toBe(0);
    expect(takeDailymotionSlot("stream", "prefetch", 0)).toBe(500);
    expect(takeDailymotionSlot("stream", "interactive", 0)).toBe(0);
    // Pas de pause après un appel attendu : la préparation précède le survol qui suit.
    expect(takeDailymotionSlot("api", "prefetch", 1000)).toBe(0);
  });

  it("la préparation laisse les 100 derniers appels de l'heure à ceux qu'on attend", () => {
    let now = 0;
    for (let i = 0; i < DAILYMOTION_API_PER_HOUR - 100; i++, now += 2000) expect(takeDailymotionSlot("api", "interactive", now)).toBe(0);
    expect(takeDailymotionSlot("api", "prefetch", now)).toBeGreaterThan(0);
    expect(takeDailymotionSlot("api", "interactive", now)).toBe(0);
  });

  it("le fond cède la place 30 s après un appel attendu", () => {
    expect(takeDailymotionSlot("api", "interactive", 0)).toBe(0);
    expect(takeDailymotionSlot("api", "background", 10_000)).toBe(20_000);
    expect(takeDailymotionSlot("api", "background", 30_000)).toBe(0);
  });

  it("un 429 ou un 403 ouvre le disjoncteur ; trois 5xx d'affilée aussi ; un succès le referme", () => {
    recordDailymotionResponse(429, 0);
    expect(dailymotionGuardStatus(0)).toEqual({ state: "paused", until: 30 * MIN, reason: "limit" });
    expect(takeDailymotionSlot("api", "interactive", MIN)).toBe(29 * MIN);
    recordDailymotionResponse(200, 31 * MIN);
    expect(dailymotionGuardStatus(31 * MIN)).toEqual({ state: "normal" });
    recordDailymotionResponse(502, 32 * MIN);
    recordDailymotionResponse(503, 32 * MIN);
    expect(dailymotionGuardStatus(32 * MIN).state).toBe("normal");
    recordDailymotionResponse(500, 32 * MIN);
    expect(dailymotionGuardStatus(32 * MIN)).toEqual({ state: "paused", until: 62 * MIN, reason: "errors" });
  });
});

describe("l'état survit au redémarrage", () => {
  it("un disjoncteur ouvert et les budgets de l'heure se reprennent", async () => {
    const now = Date.now();
    tripYouTubeBreaker("bot", now);
    recordDailymotionResponse(403, now);
    for (let i = 0; i < 10; i++) takeYouTubePlayback(`u${i}`, now);
    await saveGuardState();
    const saved = stored.get(GUARD_STATE_KEY);
    expect(saved).toBeTruthy();

    resetYouTubeGuard();
    resetDailymotionGuard();
    expect(youtubeGuardStatus(now).state).toBe("normal");
    restoreGuardState(saved, now + 1000);
    expect(youtubeGuardStatus(now + 1000)).toEqual({ state: "paused", until: now + 30 * MIN, reason: "bot" });
    expect(dailymotionGuardStatus(now + 1000).state).toBe("paused");
  });

  it("une valeur illisible ou d'une autre version : on repart de rien", () => {
    restoreGuardState("{nope");
    restoreGuardState(JSON.stringify({ version: 99, youtube: { breaker: { openUntil: Date.now() + MIN } } }));
    expect(youtubeGuardStatus().state).toBe("normal");
  });
});
