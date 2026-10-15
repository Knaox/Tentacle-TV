/**
 * La politique de contenu : lue dans Jellyfin, gardée 30 s, vidée à l'écriture,
 * FERMÉE dès que Jellyfin ne répond pas.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: 0,
  reply: null as null | { ok: true; data: unknown } | { ok: false; failure: string },
}));

vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async () => {
    state.calls++;
    return state.reply;
  },
}));

import {
  clearContentPolicyCache,
  contentPolicyFromJellyfin,
  getContentPolicy,
  invalidateContentPolicy,
  isRestricted,
  onContentPolicyInvalidated,
} from "./index";

const USER = "8f0c2f4a9e7b4d1c8a3b2c1d0e9f8a7b";

function policy(fields: Record<string, unknown>) {
  state.reply = { ok: true, data: { Id: USER, Policy: { IsAdministrator: false, ...fields } } };
}

beforeEach(() => {
  clearContentPolicyCache();
  state.calls = 0;
  state.reply = null;
});

describe("contentPolicyFromJellyfin", () => {
  it("un compte sans restriction n'est pas restreint", () => {
    const result = contentPolicyFromJellyfin(USER, { EnableAllFolders: true, MaxParentalRating: null, BlockedTags: [] });
    expect(result.restricted).toBe(false);
    expect(result.enableAllFolders).toBe(true);
  });

  it.each([
    [{ MaxParentalRating: 12 }],
    [{ BlockedTags: ["horreur"] }],
    [{ AllowedTags: ["enfants"] }],
    [{ BlockUnratedItems: ["Movie"] }],
  ])("%j suffit à restreindre", (fields) => {
    expect(contentPolicyFromJellyfin(USER, fields).restricted).toBe(true);
  });

  it("normalise les bibliothèques et lit les plages horaires", () => {
    const result = contentPolicyFromJellyfin(USER, {
      EnabledFolders: ["F137A2DD-21BB-C1B9-9AA5-C0F6BF02A805"],
      AccessSchedules: [{ Id: 1, UserId: USER, DayOfWeek: "Weekend", StartHour: 9, EndHour: 18 }, { DayOfWeek: "Nope" }],
    });
    expect(result.enabledFolders).toEqual(["f137a2dd21bbc1b99aa5c0f6bf02a805"]);
    expect(result.accessSchedules).toEqual([{ dayOfWeek: "Weekend", startHour: 9, endHour: 18 }]);
  });
});

describe("getContentPolicy", () => {
  it("fermée à l'échec : Jellyfin muet = le plus restreint", async () => {
    state.reply = { ok: false, failure: "unreachable" };
    const result = await getContentPolicy(USER);
    expect(result.readable).toBe(false);
    expect(result.restricted).toBe(true);
    expect(result.maxParentalRating).toBe(0);
    expect(result.enableAllFolders).toBe(false);
  });

  it("fermée pour une réponse sans politique, ou un identifiant qui n'en est pas un", async () => {
    state.reply = { ok: true, data: { Id: USER } };
    expect((await getContentPolicy(USER)).readable).toBe(false);
    expect((await getContentPolicy("../Users")).readable).toBe(false);
  });

  it("gardée 30 s, une seule lecture pour des appels simultanés, relue après invalidation", async () => {
    policy({ MaxParentalRating: 10 });
    const [a, b] = await Promise.all([getContentPolicy(USER), getContentPolicy(USER.toUpperCase())]);
    expect(a.maxParentalRating).toBe(10);
    expect(b).toBe(a);
    expect(state.calls).toBe(1);
    await getContentPolicy(USER);
    expect(state.calls).toBe(1);
    policy({});
    invalidateContentPolicy(USER);
    expect(await isRestricted(USER)).toBe(false);
    expect(state.calls).toBe(2);
  });
});

describe("onContentPolicyInvalidated", () => {
  it("prévient, de façon synchrone, pour un compte (normalisé) puis pour tous ; se désabonne", () => {
    const seen: (string | null)[] = [];
    const stop = onContentPolicyInvalidated((userId) => seen.push(userId));
    invalidateContentPolicy("8F0C2F4A-9E7B-4D1C-8A3B-2C1D0E9F8A7B");
    expect(seen).toEqual([USER]);
    clearContentPolicyCache();
    expect(seen).toEqual([USER, null]);
    stop();
    invalidateContentPolicy(USER);
    expect(seen).toHaveLength(2);
  });

  it("un écouteur qui lève est journalisé et n'empêche pas les autres", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const seen: (string | null)[] = [];
    const stopA = onContentPolicyInvalidated(() => {
      throw new Error("boum");
    });
    const stopB = onContentPolicyInvalidated((userId) => seen.push(userId));
    invalidateContentPolicy(USER);
    expect(seen).toEqual([USER]);
    expect(log.mock.calls.some((call) => String(call[0]).includes("[content-policy]"))).toBe(true);
    stopA();
    stopB();
    log.mockRestore();
  });
});
