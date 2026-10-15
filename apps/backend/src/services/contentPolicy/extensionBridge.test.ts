/**
 * Le pont des extensions (Vigie) : la règle des recommandations — un titre que
 * la bibliothèque cache au compte n'est jamais « à demander » (banc du contrôle
 * parental : Coraline, classé « 10 » chez Jellyfin, revenait à un compte
 * « 6 ans » par la découverte de Vigie) — et le chemin court d'un compte libre.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  reply: null as null | { ok: true; data: unknown } | { ok: false; failure: string },
  filtered: [] as Array<{ mediaType: string; tmdbId: number }>,
  rightsCalls: 0,
}));

vi.mock("../jellyfinAdminFetch", () => ({ jellyfinAdminFetch: async () => state.reply }));
vi.mock("../reco/recoRights", () => ({
  filterByRights: async (_user: string, items: Array<{ mediaType: string; tmdbId: number }>) => {
    state.rightsCalls++;
    // Jellyfin cache Coraline (14836) au compte ; le reste passe.
    state.filtered = items.filter((item) => item.tmdbId !== 14836);
    return state.filtered.map((item) => ({ ...item, extra: "objet du pont" }));
  },
  titleAllowedFor: async (_user: string, item: { tmdbId: number }) => {
    state.rightsCalls++;
    return item.tmdbId !== 14836;
  },
}));

import { clearContentPolicyCache } from "./contentPolicy";
import { contentPolicyBridge } from "./extensionBridge";

const USER = "8f0c2f4a9e7b4d1c8a3b2c1d0e9f8a7b";
const policy = (fields: Record<string, unknown>) => {
  state.reply = { ok: true, data: { Id: USER, Policy: { IsAdministrator: false, EnableAllFolders: true, ...fields } } };
};
const CORALINE = { mediaType: "movie" as const, tmdbId: 14836 };
const NEMO = { mediaType: "movie" as const, tmdbId: 12 };

beforeEach(() => {
  clearContentPolicyCache();
  state.rightsCalls = 0;
});

describe("le pont des extensions", () => {
  it("un compte libre reçoit les titres tels quels, sans question de plus ; entrées mal formées écartées", async () => {
    policy({});
    const bridge = contentPolicyBridge();
    const titles = await bridge.filterExternalTitles(USER, [CORALINE, { mediaType: "book", tmdbId: 1 } as never, { mediaType: "tv", tmdbId: -3 }]);
    expect(titles).toEqual([CORALINE]);
    expect(await bridge.isRestricted(USER)).toBe(false);
    expect(await bridge.allowsExternalTitle(USER, CORALINE)).toBe(true);
    expect(state.rightsCalls).toBe(0);
  });

  it("un compte restreint : un titre que la bibliothèque lui cache ne passe jamais, et le pont rend des copies", async () => {
    policy({ MaxParentalRating: 6 });
    const bridge = contentPolicyBridge();
    expect(await bridge.filterExternalTitles(USER, [CORALINE, NEMO])).toEqual([NEMO]);
    expect(await bridge.allowsExternalTitle(USER, CORALINE)).toBe(false);
    expect(await bridge.allowsExternalTitle(USER, NEMO)).toBe(true);
  });

  it("des bibliothèques bornées suffisent à filtrer (sans note maximale)", async () => {
    policy({ EnableAllFolders: false, EnabledFolders: ["f137a2dd21bbc1b99aa5c0f6bf02a805"] });
    const bridge = contentPolicyBridge();
    expect(await bridge.isRestricted(USER)).toBe(true);
    expect(await bridge.filterExternalTitles(USER, [CORALINE, NEMO])).toEqual([NEMO]);
  });

  it("une politique illisible filtre (fermé à l'échec) ; une entrée nulle est refusée", async () => {
    state.reply = { ok: false, failure: "unreachable" };
    const bridge = contentPolicyBridge();
    expect(await bridge.isRestricted(USER)).toBe(true);
    expect(await bridge.filterExternalTitles(USER, [CORALINE])).toEqual([]);
    expect(await bridge.allowsExternalTitle(USER, null as never)).toBe(false);
  });
});
