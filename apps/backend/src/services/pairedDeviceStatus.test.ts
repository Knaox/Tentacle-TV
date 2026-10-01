/**
 * Le verdict « encore jumelé ? » : une ligne `paired_devices` pour l'empreinte
 * du jeton, gardée en mémoire quelques secondes, effacée sur-le-champ par la
 * révocation. Prisma en mémoire.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isDeviceRevoked,
  markDeviceRevoked,
  pairedDeviceStatus,
  resetPairedDeviceStatusForTests,
} from "./pairedDeviceStatus";

const db = vi.hoisted(() => ({
  rows: new Set<string>(),
  reads: 0,
  touches: 0,
  down: false,
}));

vi.mock("./jwt", () => ({
  hashToken: (value: string) => `h:${value}`,
  verifyDeviceToken: async (token: string) =>
    token.startsWith("jwt-") ? { userId: "u1", username: "Knaoxtest", isAdmin: false, deviceId: "d", type: "paired_device" } : null,
}));
vi.mock("./db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    pairedDevice: {
      findUnique: async (args: { where: { tokenHash: string } }) => {
        db.reads++;
        if (db.down) throw new Error("base tombée");
        return db.rows.has(args.where.tokenHash) ? { id: "row" } : null;
      },
      updateMany: async () => {
        db.touches++;
        return { count: 1 };
      },
    },
  }),
}));

beforeEach(() => {
  resetPairedDeviceStatusForTests();
  db.rows.clear();
  db.reads = 0;
  db.touches = 0;
  db.down = false;
});

describe("le verdict d'un jeton", () => {
  it("ne tranche pas ce qui n'est pas un jeton d'appareil", async () => {
    expect(await pairedDeviceStatus("jeton-jellyfin")).toEqual({ status: "not_device" });
    expect(db.reads).toBe(0);
  });

  it("dit jumelé quand la ligne existe", async () => {
    db.rows.add("h:jwt-salon");
    const verdict = await pairedDeviceStatus("jwt-salon");
    expect(verdict.status).toBe("paired");
  });

  it("dit révoqué quand la ligne n'existe plus, et le retient", async () => {
    expect((await pairedDeviceStatus("jwt-salon")).status).toBe("revoked");
    db.rows.add("h:jwt-salon"); // une empreinte ne revient jamais — le verdict reste
    expect((await pairedDeviceStatus("jwt-salon")).status).toBe("revoked");
    expect(isDeviceRevoked("h:jwt-salon")).toBe(true);
  });

  it("ne tranche pas quand la base ne répond pas", async () => {
    db.down = true;
    expect((await pairedDeviceStatus("jwt-salon")).status).toBe("unreachable");
  });
});

describe("le verdict en mémoire", () => {
  it("épargne la base aux requêtes en rafale", async () => {
    db.rows.add("h:jwt-salon");
    for (let i = 0; i < 20; i++) await pairedDeviceStatus("jwt-salon");
    expect(db.reads).toBe(1);
  });

  it("n'écrit lastSeen qu'une fois pour la rafale", async () => {
    db.rows.add("h:jwt-salon");
    for (let i = 0; i < 20; i++) await pairedDeviceStatus("jwt-salon");
    expect(db.touches).toBe(1);
  });

  it("cède aussitôt à la révocation, même en mémoire", async () => {
    db.rows.add("h:jwt-salon");
    await pairedDeviceStatus("jwt-salon");
    markDeviceRevoked("h:jwt-salon");
    expect((await pairedDeviceStatus("jwt-salon")).status).toBe("revoked");
  });

  it("ne touche pas l'autre appareil du compte", async () => {
    db.rows.add("h:jwt-salon");
    db.rows.add("h:jwt-chambre");
    markDeviceRevoked("h:jwt-salon");
    expect((await pairedDeviceStatus("jwt-chambre")).status).toBe("paired");
  });

  it("fait gagner une révocation survenue pendant la lecture de la base", async () => {
    db.rows.add("h:jwt-salon");
    const pending = pairedDeviceStatus("jwt-salon");
    markDeviceRevoked("h:jwt-salon");
    expect((await pending).status).toBe("revoked");
  });
});
