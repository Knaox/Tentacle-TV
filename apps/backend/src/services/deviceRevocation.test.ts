/**
 * La révocation commune : effective dès la transaction (journal + jumelage
 * supprimé), puis la TV prévenue, sa session Jellyfin arrêtée AVANT que son
 * jeton ne meure, et son appareil Jellyfin supprimé — retenté jusqu'à
 * confirmation, et repris après un plantage par le balayage du journal.
 * Faux Jellyfin, base en mémoire ; sockets, canal et caches observés.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeJellyfin, fakeJellyfinFetch, type FakeJellyfin } from "../../test/fakeJellyfinDevices";
import { createPairingDb } from "../../test/fakePairingDb";

const h = vi.hoisted(() => ({
  db: null as ReturnType<typeof import("../../test/fakePairingDb").createPairingDb> | null,
  events: [] as string[],
}));

vi.mock("./configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle-admin" }));
vi.mock("./db", () => ({ hasPrisma: () => true, getPrisma: () => h.db!.client }));
vi.mock("./deviceSessions/deviceAuth", () => ({ pairedDeviceIdForHash: async (hash: string) => `derive-${hash}` }));
vi.mock("./deviceSessions/gateway", () => ({
  endPairedDeviceSessions: async (id: string) => void h.events.push(`session fermée ${id}`),
}));
vi.mock("./wsManager", () => ({ revokeDeviceByTokenHash: (hash: string) => void h.events.push(`socket ${hash}`) }));
vi.mock("../middleware/auth", () => ({ forgetValidatedToken: (t: string) => void h.events.push(`oublie ${t}`) }));
vi.mock("./deviceTokenHealth", () => ({ forgetJellyfinTokenOwner: () => undefined }));
vi.mock("./pairedDeviceStatus", () => ({ markDeviceRevoked: (hash: string) => void h.events.push(`refusé ${hash}`) }));

import { revokePairedDevice } from "./deviceRevocation";
import { sweepJellyfinDevices } from "./jellyfinDeviceCleanup";

const USER = "b52628a704304f06a682f6037183b976";
let jf: FakeJellyfin;

async function tv(hash: string, own = true): Promise<string> {
  const row = await h.db!.client.pairedDevice.create({
    data: {
      tokenHash: hash, jellyfinUserId: USER, name: "Apple TV",
      jellyfinAccessToken: `jf-${hash}`, jellyfinDeviceId: own ? `jfdev-${hash}` : null,
    },
  });
  if (own) jf.devices.set(`jfdev-${hash}`, { userId: USER, token: `jf-${hash}` });
  return row.id;
}

beforeEach(() => {
  h.db = createPairingDb();
  h.events = [];
  jf = createFakeJellyfin();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") h.events.push("jellyfin supprime");
    return fakeJellyfinFetch(jf)(url, init);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("une TV révoquée", () => {
  it("est effacée, refusée, prévenue, puis oubliée de Jellyfin — dans cet ordre", async () => {
    const id = await tv("salon");
    const revocation = await revokePairedDevice({ id }, "user");
    expect(h.db!.state.devices).toEqual([]);
    await revocation!.settled;
    expect(h.events).toEqual([
      "refusé salon", "oublie jf-salon", "socket salon", "session fermée jfdev-salon", "jellyfin supprime",
    ]);
    expect(jf.devices.size).toBe(0);
    expect(h.db!.state.cleanups).toEqual([]);
  });

  it("ne touche ni la ligne ni l'appareil Jellyfin de l'autre TV du compte", async () => {
    const id = await tv("salon");
    await tv("chambre");
    await (await revokePairedDevice({ id }, "user"))!.settled;
    expect(h.db!.state.devices.map((d) => d.tokenHash)).toEqual(["chambre"]);
    expect([...jf.devices.keys()]).toEqual(["jfdev-chambre"]);
  });

  it("d'un jumelage d'avant : sa session est fermée, rien d'autre chez Jellyfin", async () => {
    const id = await tv("salon", false);
    await (await revokePairedDevice({ id }, "user"))!.settled;
    expect(h.events).toContain("session fermée derive-salon");
    expect(h.events).not.toContain("jellyfin supprime");
    expect(h.db!.state.cleanups).toEqual([]);
  });

  it("déjà révoquée : rien à défaire, la porte reste close", async () => {
    expect(await revokePairedDevice({ tokenHash: "salon" }, "self")).toBeNull();
    expect(h.events).toEqual(["refusé salon"]);
  });

  it("base en panne : rien n'est révoqué à moitié", async () => {
    const id = await tv("salon");
    h.db!.state.down = true;
    await expect(revokePairedDevice({ id }, "user")).rejects.toThrow();
    h.db!.state.down = false;
    expect(h.db!.state.devices).toHaveLength(1);
    expect(h.events).toEqual([]);
  });
});

describe("Jellyfin absent ou Tentacle planté pendant la révocation", () => {
  it("la révocation tient, et l'appareil Jellyfin reste au journal", async () => {
    const id = await tv("salon");
    jf.failing.add("delete");
    await (await revokePairedDevice({ id }, "user"))!.settled;
    expect(h.db!.state.devices).toEqual([]);
    expect(jf.devices.has("jfdev-salon")).toBe(true);
    expect(h.db!.state.cleanups.map((c) => [c.jellyfinDeviceId, c.reason, c.attempts])).toEqual([["jfdev-salon", "revoked", 1]]);
  });

  it("le balayage du démarrage suivant achève la révocation", async () => {
    const id = await tv("salon");
    jf.failing.add("delete");
    await (await revokePairedDevice({ id }, "user"))!.settled;
    // Redémarrage : Jellyfin est revenu, l'heure de la nouvelle tentative est passée.
    jf.failing.clear();
    await sweepJellyfinDevices(Date.now() + 24 * 60 * 60_000);
    expect(jf.devices.size).toBe(0);
    expect(h.db!.state.cleanups).toEqual([]);
  });

  it("une révocation l'emporte sur une frappe journalisée pour le même appareil", async () => {
    const id = await tv("salon");
    await h.db!.client.pairedDeviceCleanup.upsert({
      where: { jellyfinDeviceId: "jfdev-salon" },
      create: { jellyfinDeviceId: "jfdev-salon", tokenHash: "salon", reason: "minting" }, update: {},
    });
    jf.failing.add("delete");
    await (await revokePairedDevice({ id }, "user"))!.settled;
    expect(h.db!.state.cleanups[0].reason).toBe("revoked");
  });
});
