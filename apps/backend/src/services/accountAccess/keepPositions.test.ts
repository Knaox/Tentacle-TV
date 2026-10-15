import { describe, expect, it, vi } from "vitest";

/** Bloqué en pleine lecture : la position est écrite au nom du compte, par la clé d'administration. */

const calls = vi.hoisted(() => [] as { path: string; body: unknown }[]);
vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async (path: string, options: { body: unknown }) => {
    calls.push({ path, body: options.body });
    return { ok: true, data: {} };
  },
}));
vi.mock("../deviceSessions/gateway", () => ({
  sessionConnections: () => [
    { userId: "AAAA-bbbb", playback: { itemId: "film", positionTicks: 900_000_000 } },
    { userId: "aaaabbbb", playback: null },
    { userId: "autre", playback: { itemId: "x", positionTicks: 1 } },
  ],
}));

import { keepPlaybackPositions } from "./keepPositions";

describe("position gardée avant la coupure", () => {
  it("chaque lecture du compte, et seulement les siennes", async () => {
    expect(await keepPlaybackPositions("aaaabbbb", Date.UTC(2026, 9, 15, 14, 48))).toBe(1);
    expect(calls).toEqual([
      {
        path: "/UserItems/film/UserData?userId=aaaabbbb",
        body: { PlaybackPositionTicks: 900_000_000, LastPlayedDate: "2026-10-15T14:48:00.000Z" },
      },
    ]);
  });
});
