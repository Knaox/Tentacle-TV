import { describe, expect, it } from "vitest";
import type { LiveContent } from "@tentacle-tv/offline-core";
import { liveDuration, liveTexts } from "./liveText";

const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}${JSON.stringify(params)}` : key);

function content(over: Partial<LiveContent> = {}): LiveContent {
  return { phase: "transferring", remaining: 3, total: 3, percent: 40, endsAtMs: 12 * 60_000, single: null, seriesName: null, ...over };
}

describe("liveDuration", () => {
  it("arrondit à la minute, avec les heures au-delà", () => {
    expect(liveDuration(20_000, t)).toBe("offline:liveDurationSoon");
    expect(liveDuration(12 * 60_000, t)).toBe('offline:liveDurationMinutes{"minutes":12}');
    expect(liveDuration(65 * 60_000, t)).toBe('offline:liveDurationHours{"hours":1,"minutes":"05"}');
  });
});

describe("liveTexts", () => {
  it("un lot de plusieurs titres se compte, et dit dans combien de temps", () => {
    const texts = liveTexts(content(), 0, t, () => null);
    expect(texts.headline).toBe('offline:liveCount{"count":3}');
    expect(texts.status).toBe('offline:liveReadyInText{"time":"offline:liveDurationMinutes{\\"minutes\\":12}"}');
    expect(texts.deepLink).toBe("tentacle://on-device");
  });

  it("un seul titre se nomme (avec son code d'épisode) ; le toucher mène aux transferts", () => {
    const single = { itemId: "abc", title: "Pilote", seriesName: "Dark", kind: "episode" };
    const texts = liveTexts(content({ remaining: 1, single }), 0, t, () => "S01E01 · Pilote");
    expect(texts.headline).toBe("S01E01 · Pilote");
    // « Sur cet appareil », où l'on voit les transferts avancer (Damien, 20/10).
    expect(texts.deepLink).toBe("tentacle://on-device");
  });

  it("des épisodes d'une même série se disent sous son nom", () => {
    expect(liveTexts(content({ seriesName: "Dark" }), 0, t, () => null).headline).toBe(
      'offline:liveSeries{"series":"Dark","count":3}',
    );
  });

  it("une attente se DIT, jamais un compte à rebours", () => {
    expect(liveTexts(content({ phase: "waitingWifi", endsAtMs: null }), 0, t, () => null).status).toBe("offline:liveWaitingWifi");
    expect(liveTexts(content({ phase: "waitingNetwork", endsAtMs: null }), 0, t, () => null).status).toBe("offline:liveWaitingNetwork");
    expect(liveTexts(content({ phase: "paused", endsAtMs: null }), 0, t, () => null).status).toBe("offline:livePaused");
    expect(liveTexts(content({ phase: "retrying", endsAtMs: null }), 0, t, () => null).status).toBe("offline:liveRetrying");
  });

  it("sans fin connue, on estime encore", () => {
    expect(liveTexts(content({ endsAtMs: null }), 0, t, () => null).status).toBe("offline:liveEstimating");
  });
});
