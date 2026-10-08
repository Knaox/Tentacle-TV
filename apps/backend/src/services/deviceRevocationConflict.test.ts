/**
 * La révocation face à une écriture qui n'a pas pu passer (conflit P2034,
 * verrou tenu par un autre processus) : la révocation relit et rejoue, la TV
 * est bel et bien déjumelée, jamais laissée dans la liste.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPairingDb } from "../../test/fakePairingDb";

const h = vi.hoisted(() => ({
  db: null as ReturnType<typeof import("../../test/fakePairingDb").createPairingDb> | null,
}));

vi.mock("./configStore", () => ({ getJellyfinUrl: () => "http://jf.test", getJellyfinApiKey: () => "cle-admin" }));
vi.mock("./db", () => ({ hasPrisma: () => true, getPrisma: () => h.db!.client }));
vi.mock("./deviceSessions/deviceAuth", () => ({ pairedDeviceIdForHash: async () => null }));
vi.mock("./deviceSessions/gateway", () => ({ endPairedDeviceSessions: async () => undefined }));
vi.mock("./wsManager", () => ({ revokeDeviceByTokenHash: () => undefined }));
vi.mock("../middleware/auth", () => ({ forgetValidatedToken: () => undefined }));
vi.mock("./deviceTokenHealth", () => ({ forgetJellyfinTokenOwner: () => undefined }));
vi.mock("./pairedDeviceStatus", () => ({ markDeviceRevoked: () => undefined }));
vi.mock("./jellyfinDeviceCleanup", () => ({ cleanupJellyfinDevice: async () => false }));

import { revokePairedDevice } from "./deviceRevocation";

const conflict = () => Object.assign(new Error("Record has changed since last read in table 'paired_devices'"), { code: "P2034" });

beforeEach(() => {
  h.db = createPairingDb();
});

describe("une révocation qui croise une écriture de la même ligne", () => {
  it("est rejouée, et la TV quitte bien la base", async () => {
    const row = await h.db!.client.pairedDevice.create({ data: { tokenHash: "salon", jellyfinUserId: "u1", name: "Shield" } });
    const real = h.db!.client.$transaction;
    let calls = 0;
    h.db!.client.$transaction = (async (fn: Parameters<typeof real>[0]) => {
      calls += 1;
      if (calls === 1) throw conflict();
      return real(fn);
    }) as typeof real;
    expect(await revokePairedDevice({ id: row.id }, "user")).not.toBeNull();
    expect(calls).toBe(2);
    expect(h.db!.state.devices).toEqual([]);
  });

  it("journalise l'appareil Jellyfin posé APRÈS la première lecture", async () => {
    const row = await h.db!.client.pairedDevice.create({ data: { tokenHash: "salon", jellyfinUserId: "u1", name: "Shield" } });
    const real = h.db!.client.$transaction;
    h.db!.client.$transaction = (async (fn: Parameters<typeof real>[0]) => {
      // Le jeton propre de la TV arrive entre la lecture et la transaction.
      await h.db!.client.pairedDevice.updateMany({ where: { tokenHash: "salon" }, data: { jellyfinDeviceId: "jfdev-salon" } });
      return real(fn);
    }) as typeof real;
    await revokePairedDevice({ id: row.id }, "user");
    expect(h.db!.state.devices).toEqual([]);
    expect(h.db!.state.cleanups.map((c) => c.jellyfinDeviceId)).toEqual(["jfdev-salon"]);
  });
});
