/**
 * Le jeton Jellyfin rendu pour un appareil jumelé est son jeton PROPRE, s'il
 * appartient au compte de l'appareil — jamais celui d'un appareil frère.
 * Prisma en mémoire, Jellyfin bouchonné par le `fetch` global : chaque jeton
 * connaît son propriétaire (`/Users/Me`) ; la frappe d'un jeton propre est
 * bouchonnée (testée dans `deviceJellyfinToken.test.ts`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modernJellyfinToken } from "../../test/jellyfinFakeAuth";
// Import statique : Vitest remonte les `vi.mock` ci-dessous AU-DESSUS des
// imports, le module est donc chargé avec ses bouchons. Un `await import` de
// premier niveau faisait la même chose, mais le typecheck (tests compris) le
// refuse avec le `module` du backend (TS1378).
import {
  resolvePairedDeviceToken, clearDeviceTokenIfInvalid, resetTokenOwnerCacheForTests,
} from "./deviceTokenHealth";

const minted = vi.hoisted(() => ({ calls: [] as string[], token: null as string | null }));
vi.mock("./deviceJellyfinToken", () => ({
  ensureOwnJellyfinToken: async (tokenHash: string) => {
    minted.calls.push(tokenHash);
    return minted.token;
  },
}));

interface Row {
  tokenHash: string;
  name: string;
  jellyfinUserId: string;
  jellyfinAccessToken: string | null;
  jellyfinDeviceId: string | null;
  lastSeen: Date;
}
let rows: Row[] = [];
let jellyfinDown = false;
/** jeton Jellyfin → id du propriétaire ; absent = 401. */
const owners = new Map<string, string>();

vi.mock("./configStore", () => ({ getJellyfinUrl: () => "http://jf.test" }));
vi.mock("./jwt", () => ({ hashToken: (value: string) => `h:${value}` }));
vi.mock("./db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    pairedDevice: {
      findUnique: async (args: { where: { tokenHash: string } }) =>
        rows.find((r) => r.tokenHash === args.where.tokenHash) ?? null,
      update: async (args: { where: { tokenHash: string }; data: { jellyfinAccessToken: string | null } }) => {
        const row = rows.find((r) => r.tokenHash === args.where.tokenHash);
        if (!row) throw new Error("absent");
        row.jellyfinAccessToken = args.data.jellyfinAccessToken;
        return row;
      },
    },
  }),
}));

const KNAOX = "f12b22ea52da40ef8b8bbafcfa1df3dc";
const TEST = "b52628a704304f06a682f6037183b976";

/** `own` : le jeton a été frappé pour CET appareil ; sinon, jumelage d'avant. */
function device(jwt: string, userId: string, token: string | null, own = true, minutesAgo = 0): void {
  rows.push({
    tokenHash: `h:${jwt}`,
    name: "Apple TV",
    jellyfinUserId: userId,
    jellyfinAccessToken: token,
    jellyfinDeviceId: own && token ? `jf-device-${jwt}` : null,
    lastSeen: new Date(Date.now() - minutesAgo * 60_000),
  });
}
const stored = (jwt: string) => rows.find((r) => r.tokenHash === `h:${jwt}`)?.jellyfinAccessToken;

beforeEach(() => {
  rows = [];
  minted.calls = [];
  minted.token = null;
  jellyfinDown = false;
  owners.clear();
  owners.set("jf-knaox", KNAOX);
  owners.set("jf-test", TEST);
  owners.set("jf-test-2", TEST);
  resetTokenOwnerCacheForTests();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: { headers?: Record<string, string> }) => {
    if (jellyfinDown) throw new Error("ECONNREFUSED");
    const owner = owners.get(modernJellyfinToken(init?.headers));
    if (!owner) return new Response("", { status: 401 });
    return new Response(JSON.stringify({ Id: owner, Name: "x" }), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("resolvePairedDeviceToken", () => {
  it("rend le jeton propre quand il est du compte de l'appareil", async () => {
    device("tv", TEST, "jf-test");
    expect(await resolvePairedDeviceToken("tv", TEST)).toBe("jf-test");
    expect(minted.calls).toEqual([]);
  });

  it("garde le jeton propre quand Jellyfin ne répond pas", async () => {
    device("tv", TEST, "jf-test");
    jellyfinDown = true;
    expect(await resolvePairedDeviceToken("tv", TEST)).toBe("jf-test");
    expect(stored("tv")).toBe("jf-test");
  });

  it("ne rend jamais le jeton d'un jumelage d'avant, copié d'un autre appareil", async () => {
    // Le jeton du téléphone qui avait confirmé : du bon compte, et valide.
    device("tv", TEST, "jf-test", false);
    minted.token = "jf-propre";
    expect(await resolvePairedDeviceToken("tv", TEST)).toBe("jf-propre");
    expect(stored("tv")).toBeNull(); // la copie quitte la base
    expect(minted.calls).toEqual(["h:tv"]);
  });

  it("frappe un jeton neuf quand le propre a été supprimé chez Jellyfin", async () => {
    device("tv", TEST, "jf-supprime");
    minted.token = "jf-neuf";
    expect(await resolvePairedDeviceToken("tv", TEST)).toBe("jf-neuf");
    expect(minted.calls).toEqual(["h:tv"]);
  });

  it("ne prend jamais le jeton d'un appareil frère", async () => {
    device("tv", TEST, null);
    device("phone", TEST, "jf-test-2", true, 5);
    expect(await resolvePairedDeviceToken("tv", TEST)).toBeNull();
    expect(stored("tv")).toBeNull();
    expect(stored("phone")).toBe("jf-test-2");
  });

  it("ne rend rien, et ne frappe rien, pour un jumelage révoqué", async () => {
    expect(await resolvePairedDeviceToken("revoquee", TEST)).toBeNull();
    expect(minted.calls).toEqual([]);
  });
});

describe("clearDeviceTokenIfInvalid", () => {
  it("purge un jeton d'un autre compte", async () => {
    device("tv", TEST, "jf-knaox");
    expect(await clearDeviceTokenIfInvalid("tv")).toBe(true);
    expect(stored("tv")).toBeNull();
  });

  it("garde un jeton du compte", async () => {
    device("tv", TEST, "jf-test");
    expect(await clearDeviceTokenIfInvalid("tv")).toBe(false);
    expect(stored("tv")).toBe("jf-test");
  });
});
