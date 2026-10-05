import { describe, expect, it } from "vitest";
import type { MediaStream } from "../types/media";
import { contentFrameRate, isPlausibleFrameRate } from "./contentFrameRate";

const video = (extra: Partial<MediaStream>): MediaStream => ({ Type: "Video", Index: 0, ...extra } as MediaStream);
const audio = { Type: "Audio", Index: 1 } as MediaStream;

describe("contentFrameRate", () => {
  it("prend la cadence réelle, exacte", () => {
    expect(contentFrameRate([audio, video({ RealFrameRate: 23.976, AverageFrameRate: 23.81 })])).toBe(23.976);
  });

  it("se replie sur la cadence moyenne", () => {
    expect(contentFrameRate([video({ AverageFrameRate: 25 })])).toBe(25);
  });

  it("ignore une cadence réelle aberrante au profit de la moyenne", () => {
    expect(contentFrameRate([video({ RealFrameRate: 0, AverageFrameRate: 29.97 })])).toBe(29.97);
    expect(contentFrameRate([video({ RealFrameRate: 90000, AverageFrameRate: 50 })])).toBe(50);
  });

  it("ne dit rien sans piste vidéo ni cadence plausible", () => {
    expect(contentFrameRate([audio])).toBeUndefined();
    expect(contentFrameRate([video({})])).toBeUndefined();
    expect(contentFrameRate([video({ RealFrameRate: Number.NaN })])).toBeUndefined();
    expect(contentFrameRate(undefined)).toBeUndefined();
  });

  it("borne la plausibilité", () => {
    expect(isPlausibleFrameRate(4.9)).toBe(false);
    expect(isPlausibleFrameRate(5)).toBe(true);
    expect(isPlausibleFrameRate(480)).toBe(true);
    expect(isPlausibleFrameRate(481)).toBe(false);
    expect(isPlausibleFrameRate(null)).toBe(false);
  });
});
