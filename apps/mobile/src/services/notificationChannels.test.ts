import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "android" }));
const native = vi.hoisted(() => ({
  deleteNotificationChannelAsync: vi.fn(async () => undefined),
  setNotificationChannelAsync: vi.fn(async () => null),
}));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  ...native,
}));
vi.mock("@tentacle-tv/shared", () => ({ i18n: { t: (key: string) => key } }));

beforeEach(() => {
  vi.resetModules();
  native.deleteNotificationChannelAsync.mockClear();
  native.setNotificationChannelAsync.mockClear();
  platform.OS = "android";
});

describe("canaux Android des notifications", () => {
  it("le hors ligne passe sur un canal NEUF en importance HIGH (bandeau)", async () => {
    const { ensureOfflineChannel, OFFLINE_CHANNEL_ID } = await import("./notificationChannels");
    expect(await ensureOfflineChannel()).toBe(OFFLINE_CHANNEL_ID);
    expect(OFFLINE_CHANNEL_ID).not.toBe("offline");
    expect(native.setNotificationChannelAsync).toHaveBeenCalledWith(OFFLINE_CHANNEL_ID, {
      name: "offline:tabOnDevice",
      importance: 4,
    });
  });

  it("les canaux d'avant, en DEFAULT, sont supprimés une fois par lancement", async () => {
    const { ensureOfflineChannel, retireLegacyChannels } = await import("./notificationChannels");
    await retireLegacyChannels();
    await ensureOfflineChannel();
    await ensureOfflineChannel();
    const deleted = native.deleteNotificationChannelAsync.mock.calls.map((call) => (call as unknown[])[0]);
    expect(deleted.sort()).toEqual(["default", "offline"]);
  });

  it("une suppression refusée ne bloque rien", async () => {
    native.deleteNotificationChannelAsync.mockRejectedValueOnce(new Error("refus"));
    const { ensureOfflineChannel } = await import("./notificationChannels");
    await expect(ensureOfflineChannel()).resolves.toBeTruthy();
  });

  it("iOS : aucun canal", async () => {
    platform.OS = "ios";
    const { retireLegacyChannels } = await import("./notificationChannels");
    await retireLegacyChannels();
    expect(native.deleteNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it("le canal des push (repli d'expo-notifications) porte un nom en anglais et en français", () => {
    const res = join(dirname(fileURLToPath(import.meta.url)), "../../android/app/src/main/res");
    const name = (dir: string) =>
      readFileSync(join(res, dir, "strings.xml"), "utf8").match(
        /<string name="expo_notifications_fallback_channel_name">([^<]+)<\/string>/,
      )?.[1];
    expect(name("values")).toBe("General");
    expect(name("values-fr")).toBe("Général");
  });

  it("plus aucun canal n'est créé en importance DEFAULT", () => {
    const src = join(dirname(fileURLToPath(import.meta.url)));
    for (const file of ["notificationChannels.ts", "localNotifications.ts", "pushNotifications.ts"]) {
      expect(readFileSync(join(src, file), "utf8"), file).not.toMatch(/AndroidImportance\.DEFAULT/);
    }
  });
});
