import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le service de premier plan et l'horloge d'Android suivent ce qui TIENT le
 * moteur, plus seulement ce qui transfère : une playlist dont les titres
 * attendent que le serveur les prépare n'a rien en vol, et c'est justement là
 * que la relance doit pouvoir sonner application quittée (29/10).
 */

const platform = vi.hoisted(() => ({ OS: "android" }));
const native = vi.hoisted(() => ({
  start: vi.fn(async () => true),
  stop: vi.fn(async () => undefined),
  hold: vi.fn(),
  release: vi.fn(),
  awake: vi.fn(async () => undefined),
  sleep: vi.fn(async () => undefined),
  background: true,
}));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-keep-awake", () => ({ activateKeepAwakeAsync: native.awake, deactivateKeepAwake: native.sleep }));
vi.mock("@tentacle-tv/shared", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("../../modules/offline-storage", () => ({
  onTransferPause: () => () => undefined,
  startTransferService: native.start,
  stopTransferService: native.stop,
  updateTransferService: vi.fn(),
}));
vi.mock("@/services/pushNotifications", () => ({ ensureNotificationPermission: async () => true }));
vi.mock("../../modules/offline-storage/publicLog", () => ({ publicLog: vi.fn() }));
vi.mock("./androidKeepAlive", () => ({ holdJsAlive: native.hold, releaseJsAlive: native.release }));
vi.mock("./settings", () => ({ isBackgroundTransfers: () => native.background }));

const { onEngineBusy, onEngineHeld, stopBackgroundTransfers } = await import("./backgroundTransfers");

const held = (transferring: boolean, awaitingRetry: boolean, awaitingServer = awaitingRetry) => ({ transferring, awaitingRetry, awaitingServer });

describe("ce qui tient l'application (Android)", () => {
  beforeEach(() => {
    stopBackgroundTransfers();
    vi.clearAllMocks();
    platform.OS = "android";
    native.background = true;
  });

  it("titres qui attendent le serveur : service et horloge GARDÉS, même plus rien en vol", async () => {
    onEngineBusy(true);
    onEngineHeld(held(true, false));
    await vi.waitFor(() => expect(native.start).toHaveBeenCalledTimes(1));
    expect(native.hold).toHaveBeenCalledTimes(1);

    // Les trois titres en vol répondent 503 + Retry-After : plus rien ne transfère.
    onEngineBusy(false);
    onEngineHeld(held(false, true));
    expect(native.stop).not.toHaveBeenCalled();
    expect(native.release).not.toHaveBeenCalled();

    // La relance sonne : rien ne redémarre (le service n'est jamais tombé, Android 12+ refuserait de le relancer derrière).
    onEngineBusy(true);
    onEngineHeld(held(true, false));
    expect(native.start).toHaveBeenCalledTimes(1);

    // La file est vide pour de bon : tout est rendu.
    onEngineBusy(false);
    onEngineHeld(held(false, false));
    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(native.release).toHaveBeenCalledTimes(1);
  });

  it("« Continuer en arrière-plan » désactivé : l'anti-veille suit les seuls transferts en vol", () => {
    native.background = false;
    onEngineBusy(true);
    onEngineHeld(held(true, false));
    expect(native.awake).toHaveBeenCalledTimes(1);
    expect(native.start).not.toHaveBeenCalled();

    onEngineBusy(false);
    onEngineHeld(held(false, true));
    expect(native.sleep).toHaveBeenCalled();
  });

  it("iOS : ni service ni horloge, la session d'arrière-plan et la push silencieuse s'en chargent", () => {
    platform.OS = "ios";
    onEngineHeld(held(false, true));
    expect(native.start).not.toHaveBeenCalled();
    expect(native.hold).not.toHaveBeenCalled();
  });
});
