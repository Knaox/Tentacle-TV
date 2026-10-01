/**
 * Le jeton Jellyfin PROPRE d'une TV : frappé par Quick Connect sur son
 * identifiant, rangé avec lui, une frappe à la fois — et aucun appareil ne
 * reste chez Jellyfin quand la frappe tourne mal (journal, balayage).
 * Faux Jellyfin (`test/fakeJellyfinDevices.ts`), base en mémoire.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeJellyfin, fakeJellyfinFetch, type FakeJellyfin } from "../../test/fakeJellyfinDevices";
import { createPairingDb } from "../../test/fakePairingDb";

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createPairingDb> | null }));

vi.mock("./configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle-admin" }));
vi.mock("./jwt", () => ({ hashToken: (value: string) => `h:${value}` }));
// Comme le vrai : rien qu'un alphabet d'en-tête (l'empreinte est hexadécimale).
vi.mock("./deviceSessions/deviceAuth", () => ({
  pairedDeviceIdForHash: async (hash: string) => `tentacle-x-paired-${hash.replace(/[^a-z0-9]/gi, "")}`,
}));
vi.mock("./db", () => ({ hasPrisma: () => true, getPrisma: () => db.current!.client }));

import { ensureOwnJellyfinToken, resetOwnJellyfinTokenForTests } from "./deviceJellyfinToken";
import { MINTING_GRACE_MS, cleanupJellyfinDevice, sweepJellyfinDevices } from "./jellyfinDeviceCleanup";

const USER = "b52628a704304f06a682f6037183b976";
const OWNER = { jellyfinUserId: USER, name: "Apple TV" };
const DEVICE = "tentacle-x-paired-hsalon";

let jf: FakeJellyfin;

function pair(hash: string): void {
  void db.current!.client.pairedDevice.create({ data: { tokenHash: hash, jellyfinUserId: USER, name: "Apple TV" } });
}
const row = (hash: string) => db.current!.state.devices.find((d) => d.tokenHash === hash);

beforeEach(() => {
  db.current = createPairingDb();
  jf = createFakeJellyfin();
  resetOwnJellyfinTokenForTests();
  vi.stubGlobal("fetch", vi.fn(fakeJellyfinFetch(jf)));
});
afterEach(() => vi.unstubAllGlobals());

describe("la frappe d'un jeton propre", () => {
  it("lie le jeton au compte et à l'identifiant de la TV, et le range", async () => {
    pair("h:salon");
    const token = await ensureOwnJellyfinToken("h:salon", OWNER);
    expect(token).toBeTruthy();
    expect(jf.devices.get(DEVICE)).toEqual({ userId: USER, token });
    expect(row("h:salon")).toMatchObject({ jellyfinAccessToken: token, jellyfinDeviceId: DEVICE });
    expect(db.current!.state.cleanups).toEqual([]);
  });

  it("ne frappe qu'une fois quand les demandes arrivent ensemble", async () => {
    pair("h:salon");
    const [a, b] = await Promise.all([ensureOwnJellyfinToken("h:salon", OWNER), ensureOwnJellyfinToken("h:salon", OWNER)]);
    expect(a).toBe(b);
    expect(jf.calls.filter((c) => c === "POST /QuickConnect/Initiate")).toHaveLength(1);
  });

  it("ne laisse rien quand Quick Connect est coupé, et ne le redemande pas aussitôt", async () => {
    pair("h:salon");
    jf.quickConnect = false;
    expect(await ensureOwnJellyfinToken("h:salon", OWNER)).toBeNull();
    expect(await ensureOwnJellyfinToken("h:salon", OWNER)).toBeNull();
    expect(jf.calls.filter((c) => c === "POST /QuickConnect/Initiate")).toHaveLength(1);
    expect(jf.devices.size).toBe(0);
    expect(db.current!.state.cleanups).toEqual([]);
    expect(row("h:salon")?.jellyfinAccessToken).toBeNull();
  });

  it("supprime de Jellyfin l'appareil d'un jumelage révoqué pendant la frappe", async () => {
    // Pas de ligne : révoquée entre la demande et l'enregistrement.
    expect(await ensureOwnJellyfinToken("h:salon", OWNER)).toBeNull();
    await vi.waitFor(() => expect(jf.devices.size).toBe(0));
    await vi.waitFor(() => expect(db.current!.state.cleanups).toEqual([]));
  });
});

describe("une frappe interrompue ne laisse pas d'appareil chez Jellyfin", () => {
  it("garde au journal un appareil créé dont le jeton n'est jamais revenu", async () => {
    pair("h:salon");
    jf.failing.add("authenticate");
    expect(await ensureOwnJellyfinToken("h:salon", OWNER)).toBeNull();
    expect(jf.devices.has(DEVICE)).toBe(true);
    expect(db.current!.state.cleanups.map((c) => c.reason)).toEqual(["minting"]);
  });

  it("le balayage le laisse à son auteur avant le délai, le supprime après", async () => {
    pair("h:salon");
    jf.failing.add("authorize"); // Jellyfin a autorisé, la réponse s'est perdue
    await ensureOwnJellyfinToken("h:salon", OWNER);
    await sweepJellyfinDevices(Date.now());
    expect(jf.devices.has(DEVICE)).toBe(true);
    await sweepJellyfinDevices(Date.now() + MINTING_GRACE_MS + 1);
    expect(jf.devices.has(DEVICE)).toBe(false);
    expect(db.current!.state.cleanups).toEqual([]);
  });

  it("solde sans rien toucher l'entrée d'un jumelage qui porte l'appareil", async () => {
    pair("h:salon");
    await ensureOwnJellyfinToken("h:salon", OWNER);
    await db.current!.client.pairedDeviceCleanup.upsert({
      where: { jellyfinDeviceId: DEVICE }, create: { jellyfinDeviceId: DEVICE, tokenHash: "h:salon", reason: "minting" }, update: {},
    });
    expect(await cleanupJellyfinDevice(DEVICE)).toBe(true);
    expect(jf.devices.has(DEVICE)).toBe(true);
    expect(db.current!.state.cleanups).toEqual([]);
  });
});

describe("faire disparaître un appareil de Jellyfin", () => {
  const orphan = async () => {
    jf.devices.set(DEVICE, { userId: USER, token: "jf-orphelin" });
    await db.current!.client.pairedDeviceCleanup.upsert({
      where: { jellyfinDeviceId: DEVICE }, create: { jellyfinDeviceId: DEVICE, tokenHash: "h:salon", reason: "revoked" }, update: {},
    });
  };

  it("le supprime, jeton compris", async () => {
    await orphan();
    expect(await cleanupJellyfinDevice(DEVICE)).toBe(true);
    expect(jf.devices.size).toBe(0);
  });

  for (const status of [404, 400] as const) {
    it(`tient pour fait un appareil déjà absent (Jellyfin répond ${status})`, async () => {
      jf.deleteStatus = status;
      await db.current!.client.pairedDeviceCleanup.upsert({
        where: { jellyfinDeviceId: DEVICE }, create: { jellyfinDeviceId: DEVICE, tokenHash: "h:salon", reason: "revoked" }, update: {},
      });
      expect(await cleanupJellyfinDevice(DEVICE)).toBe(true);
      expect(db.current!.state.cleanups).toEqual([]);
    });
  }

  it("garde l'entrée et repousse la tentative quand Jellyfin ne confirme pas", async () => {
    await orphan();
    jf.failing.add("delete");
    expect(await cleanupJellyfinDevice(DEVICE)).toBe(false);
    const [entry] = db.current!.state.cleanups;
    expect(entry.attempts).toBe(1);
    expect(entry.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });
});
