/**
 * Un jeton confié à un intermédiaire (relais, mot de passe) n'ajoute l'appareil
 * qu'à la première requête de la TV qui le porte. Prisma en mémoire.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { activatePendingDevice, PENDING_STATUS, PENDING_TTL_MS, recordPendingDevice } from "./pendingDevicePairing";

interface CodeRow {
  id: string;
  code: string;
  status: string;
  deviceName: string | null;
  jellyfinUserId: string | null;
  username: string | null;
  token: string | null;
  expiresAt: Date;
}

const db = vi.hoisted(() => ({
  codes: [] as CodeRow[],
  devices: new Map<string, { name: string; jellyfinUserId: string; username: string }>(),
  provisioned: [] as string[],
}));

vi.mock("./jwt", () => ({ hashToken: (value: string) => `h:${value}` }));
vi.mock("./deviceJellyfinToken", () => ({
  provisionOwnJellyfinToken: (token: string) => db.provisioned.push(token),
}));
vi.mock("../routes/pairing/codes", () => ({ freshPairingCode: async () => `C${db.codes.length}` }));
vi.mock("./db", () => ({
  getPrisma: () => ({
    pairingCode: {
      create: async ({ data }: { data: Omit<CodeRow, "id"> }) => {
        const row = { id: `id${db.codes.length}`, ...data } as CodeRow;
        db.codes.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { status: string; token: string } }) =>
        db.codes.find((c) => c.status === where.status && c.token === where.token) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        db.codes = db.codes.filter((c) => c.id !== where.id);
        return {};
      },
    },
    pairedDevice: {
      create: async ({ data }: { data: { tokenHash: string; name: string; jellyfinUserId: string; username: string } }) => {
        if (db.devices.has(data.tokenHash)) throw new Error("unique");
        db.devices.set(data.tokenHash, data);
        return data;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => (db.devices.has(where.tokenHash) ? { id: "row" } : null),
    },
  }),
}));

const OWNER = { jellyfinUserId: "u1", username: "Knaoxtest", name: "TV" };

beforeEach(() => {
  db.codes = [];
  db.devices.clear();
  db.provisioned = [];
});

describe("un jeton en attente de sa TV", () => {
  it("n'ajoute aucun appareil tant que la TV ne s'est pas présentée", async () => {
    expect(await recordPendingDevice("jwt-salon", OWNER)).toBe(true);
    expect(db.devices.size).toBe(0);
    expect(db.provisioned).toEqual([]);
    // Seule l'empreinte est gardée, jamais le jeton.
    expect(db.codes[0]).toMatchObject({ status: PENDING_STATUS, token: "h:jwt-salon" });
  });

  it("crée l'appareil à la première requête de la TV, une seule fois", async () => {
    await recordPendingDevice("jwt-salon", OWNER);
    expect(await activatePendingDevice("jwt-salon", "h:jwt-salon")).toBe(true);
    expect(db.devices.get("h:jwt-salon")).toMatchObject({ name: "TV", jellyfinUserId: "u1" });
    expect(db.provisioned).toEqual(["jwt-salon"]);
    expect(db.codes).toEqual([]);
    // Une requête jumelle arrivée après l'activation : jumelée aussi.
    expect(await activatePendingDevice("jwt-salon", "h:jwt-salon")).toBe(true);
    expect(db.provisioned).toEqual(["jwt-salon"]);
  });

  it("refuse un jeton jamais mis en attente", async () => {
    expect(await activatePendingDevice("jwt-inconnu", "h:jwt-inconnu")).toBe(false);
    expect(db.devices.size).toBe(0);
  });

  it("refuse un jeton dont l'attente est passée, et l'oublie", async () => {
    await recordPendingDevice("jwt-salon", OWNER);
    db.codes[0].expiresAt = new Date(Date.now() - 1);
    expect(await activatePendingDevice("jwt-salon", "h:jwt-salon")).toBe(false);
    expect(db.devices.size).toBe(0);
    expect(db.codes).toEqual([]);
  });

  it("attend un quart d'heure", () => {
    expect(PENDING_TTL_MS).toBe(15 * 60 * 1000);
  });
});
