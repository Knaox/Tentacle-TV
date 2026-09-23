import { describe, expect, it } from "vitest";
import { emptyPlaybackSegments } from "@tentacle-tv/shared";
import type { PlaybackSegmentsResponse } from "@tentacle-tv/shared";
import { segmentsPollInterval } from "./usePlaybackSegments";

const POLL_MS = 10_000;
const idle: PlaybackSegmentsResponse = emptyPlaybackSegments("item", "2026-01-01T00:00:00.000Z");
const pending: PlaybackSegmentsResponse = { ...idle, analysisPending: true };

describe("segmentsPollInterval", () => {
  it("forme v5 (query) : sonde tant que l'analyse tourne", () => {
    expect(segmentsPollInterval({ state: { data: pending } })).toBe(POLL_MS);
    expect(segmentsPollInterval({ state: { data: idle } })).toBe(false);
  });

  // La TV résout TanStack Query v4 au runtime : le contrat arrive en premier.
  it("forme v4 (data, query) : le contrat arrive en premier", () => {
    expect(segmentsPollInterval(pending, { state: { data: pending } })).toBe(POLL_MS);
    expect(segmentsPollInterval(idle, { state: { data: idle } })).toBe(false);
  });

  it("sans donnée : jamais de sondage", () => {
    expect(segmentsPollInterval()).toBe(false);
    expect(segmentsPollInterval(undefined, {})).toBe(false);
    expect(segmentsPollInterval(null, {})).toBe(false);
    expect(segmentsPollInterval({ state: {} })).toBe(false);
    expect(segmentsPollInterval({ state: { data: null } })).toBe(false);
  });
});
