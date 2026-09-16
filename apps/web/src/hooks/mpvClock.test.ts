import { describe, expect, it } from "vitest";
import { AUDIO_CLOCK_MAX_AGE_MS, pickClockSample } from "./mpvClock";

const T0 = 1_700_000_000_000;

describe("pickClockSample", () => {
  it("préfère l'horloge audio quand elle est fraîche et cohérente", () => {
    const picked = pickClockSample({ positionS: 10.04, at: T0 - 60 }, { positionS: 10.02, at: T0 - 30 }, T0);
    expect(picked).toEqual({ positionS: 10.02, at: T0 - 30, source: "audio" });
  });

  it("retombe sur l'image sans horloge audio, ou jamais mesurée", () => {
    expect(pickClockSample({ positionS: 10, at: T0 }, null, T0).source).toBe("video");
    expect(pickClockSample({ positionS: 10, at: T0 }, { positionS: 10, at: 0 }, T0).source).toBe("video");
    expect(pickClockSample({ positionS: 10, at: T0 }, { positionS: Number.NaN, at: T0 }, T0).source).toBe("video");
  });

  it("une horloge audio périmée ne compte plus", () => {
    const stale = { positionS: 10, at: T0 - AUDIO_CLOCK_MAX_AGE_MS - 1 };
    expect(pickClockSample({ positionS: 10.3, at: T0 }, stale, T0).source).toBe("video");
    const fresh = { positionS: 10, at: T0 - AUDIO_CLOCK_MAX_AGE_MS };
    expect(pickClockSample({ positionS: 10.3, at: T0 }, fresh, T0).source).toBe("audio");
  });

  it("un désaccord franc entre les deux horloges rend l'image maîtresse", () => {
    // Seek en vol : time-pos a sauté, l'audio n'est pas encore reparti.
    expect(pickClockSample({ positionS: 500, at: T0 }, { positionS: 120.5, at: T0 }, T0).source).toBe("video");
  });
});
