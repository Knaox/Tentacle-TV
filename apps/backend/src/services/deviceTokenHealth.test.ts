/**
 * Le jeton Jellyfin d'un appareil jumelé n'est rendu que s'il appartient au
 * compte de l'appareil. Prisma en mémoire, Jellyfin bouchonné par le `fetch`
 * global : chaque jeton connaît son propriétaire (`/Users/Me`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Import statique : Vitest remonte les `vi.mock` ci-dessous AU-DESSUS des
// imports, le module est donc chargé avec ses bouchons. Un `await import` de
// premier niveau faisait la même chose, mais le typecheck (tests compris) le
// refuse avec le `module` du backend (TS1378).
import {
  resolvePairedDeviceToken, confirmerJellyfinToken, findValidSiblingToken,
  clearDeviceTokenIfInvalid, resetTokenOwnerCacheForTests,
} from "./deviceTokenHealth";

interface Row {
  tokenHash: string;
  jellyfinUserId: string;
  jellyfinAccessToken: string | null;
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
      findMany: async (args: { where: { jellyfinUserId: string; tokenHash?: { not: string } } }) =>
        rows
          .filter((r) => r.jellyfinUserId === args.where.jellyfinUserId && r.jellyfinAccessToken !== null)
          .filter((r) => !args.where.tokenHash || r.tokenHash !== args.where.tokenHash.not)
          .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime()),
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

function device(jwt: string, userId: string, token: string | null, minutesAgo = 0): void {
  rows.push({
    tokenHash: `h:${jwt}`,
    jellyfinUserId: userId,
    jellyfinAccessToken: token,
    lastSeen: new Date(Date.now() - minutesAgo * 60_000),
  });
}
const stored = (jwt: string) => rows.find((r) => r.tokenHash === `h:${jwt}`)?.jellyfinAccessToken;

beforeEach(() => {
  rows = [];
  jellyfinDown = false;
  owners.clear();
  owners.set("jf-knaox", KNAOX);
  owners.set("jf-test", TEST);
  owners.set("jf-test-2", TEST);
  resetTokenOwnerCacheForTests();
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: { headers?: Record<string, string> }) => {
    if (jellyfinDown) throw new Error("ECONNREFUSED");
    const owner = owners.get(init?.headers?.["X-Emby-Token"] ?? "");
    if (!owner) return new Response("", { status: 401 });
    return new Response(JSON.stringify({ Id: owner, Name: "x" }), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("resolvePairedDeviceToken", () => {
  it("rend le jeton stocké quand il est du compte de l'appareil", async () => {
    device("tv", TEST, "jf-test");
    expect(await resolvePairedDeviceToken("tv", TEST)).toEqual({ token: "jf-test", purged: false });
  });

  it("retire un jeton d'un autre compte et prend celui d'un appareil frère", async () => {
    device("tv", TEST, "jf-knaox");
    device("phone", TEST, "jf-test-2", 5);
    expect(await resolvePairedDeviceToken("tv", TEST)).toEqual({ token: "jf-test-2", purged: false });
    // Regreffé : les appels suivants le trouvent directement.
    expect(stored("tv")).toBe("jf-test-2");
  });

  it("signale la purge quand aucun frère ne le remplace", async () => {
    device("tv", TEST, "jf-knaox");
    expect(await resolvePairedDeviceToken("tv", TEST)).toEqual({ token: null, purged: true });
    expect(stored("tv")).toBeNull();
  });

  it("garde le jeton stocké quand Jellyfin ne répond pas", async () => {
    device("tv", TEST, "jf-knaox");
    jellyfinDown = true;
    expect(await resolvePairedDeviceToken("tv", TEST)).toEqual({ token: "jf-knaox", purged: false });
    expect(stored("tv")).toBe("jf-knaox");
  });

  it("un appareil sans jeton hérite d'un frère valide, jamais d'un frère étranger", async () => {
    device("tv", TEST, null);
    device("old", TEST, "jf-knaox", 1);
    device("phone", TEST, "jf-test", 9);
    expect((await resolvePairedDeviceToken("tv", TEST)).token).toBe("jf-test");
    // Le frère qui portait le jeton de Knaox est nettoyé au passage.
    expect(stored("old")).toBeNull();
  });
});

describe("confirmerJellyfinToken", () => {
  it("prend le jeton de la requête quand il est du compte du confirmateur", async () => {
    expect(await confirmerJellyfinToken("jf-test", TEST)).toBe("jf-test");
  });

  it("refuse le jeton d'un autre compte et se replie sur un frère", async () => {
    device("phone", TEST, "jf-test-2");
    expect(await confirmerJellyfinToken("jf-knaox", TEST)).toBe("jf-test-2");
  });

  it("un JWT n'est jamais gravé comme jeton Jellyfin", async () => {
    expect(await confirmerJellyfinToken("a.b.c", TEST)).toBeNull();
  });
});

describe("findValidSiblingToken", () => {
  it("purge les frères morts et s'arrête sur le premier du compte", async () => {
    device("dead", TEST, "jf-revoked", 1);
    device("phone", TEST, "jf-test", 2);
    expect(await findValidSiblingToken(TEST)).toBe("jf-test");
    expect(stored("dead")).toBeNull();
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
