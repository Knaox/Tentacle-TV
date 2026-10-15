import { beforeEach, describe, expect, it, vi } from "vitest";

/** La lecture du droit « Partage public » : la politique Jellyfin fait foi, fermée à l'échec, oubliée à l'écriture. */

const state = { policy: { EnablePublicSharing: true } as Record<string, unknown> | null, down: false, calls: 0 };

vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async () => {
    state.calls++;
    if (state.down) return { ok: false, failure: "unreachable" };
    return { ok: true, data: state.policy ? { Policy: state.policy } : {} };
  },
}));

import { clearPublicSharingRightCache, mayShareInPublic } from "./publicSharingRight";
import { invalidateContentPolicy } from "../contentPolicy";

const USER = "9827c469645e471896d0c27cd8c72141";

beforeEach(() => {
  clearPublicSharingRightCache();
  state.policy = { EnablePublicSharing: true };
  state.down = false;
  state.calls = 0;
});

describe("mayShareInPublic", () => {
  it("suit EnablePublicSharing, et garde la réponse 30 s", async () => {
    expect(await mayShareInPublic(USER)).toBe(true);
    state.policy = { EnablePublicSharing: false };
    expect(await mayShareInPublic(USER)).toBe(true);
    expect(state.calls).toBe(1);
  });

  it("une écriture de politique faite par Tentacle se voit aussitôt", async () => {
    expect(await mayShareInPublic(USER)).toBe(true);
    state.policy = { EnablePublicSharing: false };
    invalidateContentPolicy(USER);
    expect(await mayShareInPublic(USER)).toBe(false);
  });

  it("fermé à l'échec : Jellyfin muet, politique absente, champ absent, identifiant invalide", async () => {
    state.down = true;
    expect(await mayShareInPublic(USER)).toBe(false);
    clearPublicSharingRightCache();
    state.down = false;
    state.policy = null;
    expect(await mayShareInPublic(USER)).toBe(false);
    clearPublicSharingRightCache();
    state.policy = {};
    expect(await mayShareInPublic(USER)).toBe(false);
    expect(await mayShareInPublic("../Users")).toBe(false);
  });
});
