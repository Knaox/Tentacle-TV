import { beforeEach, describe, expect, it, vi } from "vitest";

// L'app TUÉE : la notification qui l'a lancée n'est connue que par
// `getLastNotificationResponseAsync`. Elle doit être lue UNE fois, puis
// effacée — Android la rejoue à chaque démarrage tant qu'elle ne l'est pas.
const native = vi.hoisted(() => ({
  getLastNotificationResponseAsync: vi.fn(),
  clearLastNotificationResponseAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-notifications", () => native);
vi.mock("expo-device", () => ({ isDevice: true }));
vi.mock("expo-constants", () => ({ default: { expoConfig: {} } }));
vi.mock("./notificationChannels", () => ({ retireLegacyChannels: async () => undefined }));
vi.mock("@/startup/startupOverlays", () => ({ holdStartupOverlay: () => () => undefined }));
// L'ouverture du démarrage : le module natif (React Native) ne se charge pas sous vitest ; elle est déjà arrivée.
vi.mock("@tentacle-tv/brand-intro-native", () => ({ whenBootIntroLanded: async () => undefined }));

function response(id: string, data: Record<string, unknown>) {
  return { notification: { request: { identifier: id, content: { data } } } };
}

beforeEach(() => {
  vi.resetModules();
  native.getLastNotificationResponseAsync.mockReset();
  native.clearLastNotificationResponseAsync.mockClear();
});

describe("getInitialNotificationTap — démarrage à froid", () => {
  it("rend les données de la push qui a lancé l'app, puis l'efface", async () => {
    const { getInitialNotificationTap } = await import("./pushNotifications");
    native.getLastNotificationResponseAsync.mockResolvedValue(response("n1", { type: "ticket_reply", refId: "t1" }));
    expect(await getInitialNotificationTap()).toEqual({ type: "ticket_reply", refId: "t1" });
    expect(native.clearLastNotificationResponseAsync).toHaveBeenCalledOnce();
  });

  it("ne rejoue jamais deux fois la même push, même si l'effacement n'est pas honoré", async () => {
    const { getInitialNotificationTap } = await import("./pushNotifications");
    native.getLastNotificationResponseAsync.mockResolvedValue(response("n1", { type: "library_added", refId: "a" }));
    expect(await getInitialNotificationTap()).not.toBeNull();
    expect(await getInitialNotificationTap()).toBeNull();
  });

  it("aucune push au lancement : rien", async () => {
    const { getInitialNotificationTap } = await import("./pushNotifications");
    native.getLastNotificationResponseAsync.mockResolvedValue(null);
    expect(await getInitialNotificationTap()).toBeNull();
  });

  it("une push sans données rend un objet vide (l'ouverture retombe sur l'accueil)", async () => {
    const { getInitialNotificationTap } = await import("./pushNotifications");
    native.getLastNotificationResponseAsync.mockResolvedValue({ notification: { request: { identifier: "n2", content: {} } } });
    expect(await getInitialNotificationTap()).toEqual({});
  });

  it("app tuée, push BALAYÉE (iOS) : le geste remonte avec l'identifiant — lue, rien à ouvrir", async () => {
    const { getInitialNotificationTap } = await import("./pushNotifications");
    native.getLastNotificationResponseAsync.mockResolvedValue({
      actionIdentifier: "com.apple.UNNotificationDismissActionIdentifier",
      notification: { request: { identifier: "n3", content: { data: { type: "ticket_reply", notificationId: "srv1" } } } },
    });
    expect(await getInitialNotificationTap()).toEqual({
      type: "ticket_reply", notificationId: "srv1", actionIdentifier: "com.apple.UNNotificationDismissActionIdentifier",
    });
  });
});
