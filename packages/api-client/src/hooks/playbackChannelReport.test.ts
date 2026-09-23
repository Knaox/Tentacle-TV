/**
 * Le report par le canal : pause, reprise et saut deviennent des bords ; un
 * battement n'en est pas un ; et un arrêt que le canal ne confirme pas part
 * en HTTP, comme avant.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const channel = vi.hoisted(() => ({
  reporting: true,
  edges: [] as string[],
  stopResult: true,
}));

vi.mock("../socket/sessionChannel", () => ({
  isChannelReporting: () => channel.reporting,
  channelProgress: (event: string) => {
    if (!channel.reporting) return false;
    channel.edges.push(event);
    return true;
  },
  channelStop: () => Promise.resolve(channel.reporting && channel.stopResult),
}));

import { applyPosition, isSeekJump, reportStopped, stateFromRefs, type PlaybackStateRefs } from "./playbackChannelReport";
import type { JfClient } from "./playbackTransport";

function refs(overrides: Partial<{ position: number; paused: boolean }> = {}): PlaybackStateRefs {
  return {
    itemId: { current: "item1" },
    mediaSourceId: { current: undefined },
    playSessionId: { current: "ps1" },
    playMethod: { current: "Transcode" },
    audioStreamIndex: { current: 1 },
    subtitleStreamIndex: { current: null },
    position: { current: overrides.position ?? 100 },
    paused: { current: overrides.paused ?? false },
  };
}

beforeEach(() => {
  channel.reporting = true;
  channel.edges.length = 0;
  channel.stopResult = true;
});

describe("stateFromRefs", () => {
  it("l'état au format du canal, en ticks", () => {
    expect(stateFromRefs(refs())).toEqual({
      itemId: "item1", mediaSourceId: "item1", playSessionId: "ps1", playMethod: "Transcode",
      positionTicks: 1_000_000_000, isPaused: false, audioStreamIndex: 1, subtitleStreamIndex: -1, canSeek: true,
    });
  });
});

describe("applyPosition", () => {
  it("une pause, puis une reprise, sont des bords", () => {
    const r = refs();
    const last = { current: Date.now() };
    applyPosition(r, last, true, 100, true);
    applyPosition(r, last, true, 100, false);
    expect(channel.edges).toEqual(["pause", "unpause"]);
  });

  it("un battement ordinaire n'est pas un bord ; un saut, si", () => {
    const r = refs({ position: 100 });
    const last = { current: Date.now() };
    applyPosition(r, last, true, 100.2, false);
    expect(channel.edges).toEqual([]);
    applyPosition(r, last, true, 700, false);
    expect(channel.edges).toEqual(["seek"]);
  });

  it("avant le début, ou sans canal, rien ne part — la position est tenue quand même", () => {
    const r = refs();
    const last = { current: 0 };
    applyPosition(r, last, false, 50, true);
    channel.reporting = false;
    applyPosition(r, last, true, 60, false);
    expect(channel.edges).toEqual([]);
    expect(r.position.current).toBe(60);
  });
});

describe("isSeekJump", () => {
  it("compare à la position attendue, lecture ou pause", () => {
    expect(isSeekJump(100, 0, false, 110, 10_000)).toBe(false);
    expect(isSeekJump(100, 0, false, 130, 10_000)).toBe(true);
    expect(isSeekJump(100, 0, true, 101, 60_000)).toBe(false);
    expect(isSeekJump(100, 0, true, 40, 1_000)).toBe(true);
  });
});

describe("reportStopped", () => {
  const client = () => ({ fetch: vi.fn(() => Promise.resolve(undefined)), getBaseUrl: () => "/api/jellyfin", getToken: () => null, getDeviceId: () => "d", getAuthHeader: () => "", useCredentials: true } as unknown as JfClient & { fetch: ReturnType<typeof vi.fn> });
  const state = { itemId: "item1", playSessionId: "ps1", playMethod: "DirectPlay" as const, positionTicks: 42, isPaused: false };

  it("confirmé par le canal : aucune requête HTTP", async () => {
    const c = client();
    await reportStopped(c, state, "test");
    expect(c.fetch).not.toHaveBeenCalled();
  });

  it("sans confirmation, l'arrêt part en HTTP", async () => {
    channel.stopResult = false;
    const c = client();
    await reportStopped(c, state, "test");
    expect(c.fetch).toHaveBeenCalledWith(
      "/Sessions/Playing/Stopped",
      { method: "POST", body: JSON.stringify({ ItemId: "item1", MediaSourceId: "item1", PlaySessionId: "ps1", PositionTicks: 42 }) },
      { noAuthExpiry: true },
    );
  });
});
