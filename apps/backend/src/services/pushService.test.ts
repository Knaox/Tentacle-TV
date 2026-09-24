/**
 * La coupure des push en dev : le backend de dev lit le même Jellyfin que la
 * prod, et chaque ajout partait vers les vrais téléphones de la base locale.
 * Éprouvés : dev = rien ne part vers Expo ; production = envoi ; le bouton de
 * test d'un admin passe la coupure ; TENTACLE_DEV_PUSH=1 la lève ; et la purge
 * des jetons morts reste active quand l'envoi part.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const devices = [
  { jellyfinUserId: "u1", expoPushToken: "ExponentPushToken[aaa]", platform: "ios" },
  { jellyfinUserId: "u1", expoPushToken: "ExponentPushToken[bbb]", platform: "android" },
];
const sendPushNotificationsAsync = vi.fn();
const deleteMany = vi.fn(async () => ({ count: 0 }));

vi.mock("./db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    pushDevice: {
      findMany: async () => devices,
      deleteMany: (...args: unknown[]) => deleteMany(...(args as [])),
    },
  }),
}));

vi.mock("expo-server-sdk", () => ({
  Expo: class {
    static isExpoPushToken(token: string): boolean {
      return token.startsWith("ExponentPushToken[");
    }
    chunkPushNotifications<T>(messages: T[]): T[][] {
      return [messages];
    }
    sendPushNotificationsAsync(chunk: unknown[]): Promise<unknown[]> {
      return sendPushNotificationsAsync(chunk);
    }
  },
}));

import { isPushDeliveryEnabled, sendToUser } from "./pushService";

const payload = { title: "Dune", body: "est sorti sur Tentacle TV" };

beforeEach(() => {
  vi.unstubAllEnvs();
  sendPushNotificationsAsync.mockReset();
  sendPushNotificationsAsync.mockImplementation(async (chunk: unknown[]) =>
    chunk.map(() => ({ status: "ok", id: "t" })),
  );
  deleteMany.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("coupure des push hors production", () => {
  it("en dev, rien ne part vers Expo et le résultat le dit", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isPushDeliveryEnabled()).toBe(false);
    const res = await sendToUser("u1", payload);
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
    expect(res).toEqual({ sent: 0, invalid: 0, suppressed: true });
  });

  it("NODE_ENV absent vaut le dev : coupé", async () => {
    vi.stubEnv("NODE_ENV", "");
    const res = await sendToUser("u1", payload);
    expect(sendPushNotificationsAsync).not.toHaveBeenCalled();
    expect(res.suppressed).toBe(true);
  });

  it("en production, l'envoi part à chaque appareil", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await sendToUser("u1", payload);
    expect(sendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(sendPushNotificationsAsync.mock.calls[0][0]).toHaveLength(2);
    expect(res).toEqual({ sent: 2, invalid: 0 });
  });

  it("le bouton de test d'un admin passe la coupure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await sendToUser("u1", payload, { allowInDev: true });
    expect(sendPushNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(res.sent).toBe(2);
  });

  it("TENTACLE_DEV_PUSH=1 rouvre l'envoi en dev (banc de bout en bout)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TENTACLE_DEV_PUSH", "1");
    expect(isPushDeliveryEnabled()).toBe(true);
    await sendToUser("u1", payload);
    expect(sendPushNotificationsAsync).toHaveBeenCalledTimes(1);
  });

  it("un jeton que Expo déclare mort est purgé quand l'envoi part", async () => {
    vi.stubEnv("NODE_ENV", "production");
    sendPushNotificationsAsync.mockImplementation(async () => [
      { status: "ok", id: "t" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
    ]);
    const res = await sendToUser("u1", payload);
    expect(res).toEqual({ sent: 1, invalid: 1 });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { expoPushToken: { in: ["ExponentPushToken[bbb]"] } },
    });
  });
});
