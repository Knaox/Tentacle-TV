import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveContent } from "@tentacle-tv/offline-core";

const env = vi.hoisted(() => ({
  entries: [] as Array<Record<string, unknown>>,
  progress: new Map<number, { bytesDone: number; expectedSize: number | null; rateBps: number | null }>(),
  wifiOnly: false,
  networkType: "wifi",
  offline: false,
  live: true,
  changed: [] as Array<() => void>,
  appState: "active" as string,
  appListeners: [] as Array<(status: string) => void>,
  outcome: "shown" as string,
}));
const surface = vi.hoisted(() => ({
  available: vi.fn(() => true),
  show: vi.fn((_content: LiveContent, _texts: { status: string }) => Promise.resolve(env.outcome)),
  end: vi.fn(),
  holdTime: vi.fn(),
  releaseTime: vi.fn(),
}));

vi.mock("@tentacle-tv/shared", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return env.appState;
    },
    addEventListener: (_event: string, listener: (status: string) => void) => {
      env.appListeners.push(listener);
      return { remove: () => undefined };
    },
  },
}));
vi.mock("@tentacle-tv/offline-core/react", () => ({
  getProgressFor: (id: number) => env.progress.get(id),
  subscribeProgress: () => () => undefined,
}));
vi.mock("../connectivityStore", () => ({
  getConnectivitySnapshot: () => ({ networkType: env.networkType }),
  isOfflineMode: () => env.offline,
  subscribeConnectivity: () => () => undefined,
}));
vi.mock("../deviceSettings", () => ({
  isCellularAcked: () => false,
  isLiveTransfers: () => env.live,
  subscribeDeviceSettings: () => () => undefined,
}));
vi.mock("../engineApi", () => ({ listOfflineEntries: () => env.entries }));
vi.mock("../engineRuntime", () => ({
  subscribeOfflineChanged: (listener: () => void) => {
    env.changed.push(listener);
    return () => undefined;
  },
}));
vi.mock("../entryTitle", () => ({ entryTitle: (entry: { title: string }) => entry.title }));
vi.mock("../settings", () => ({ isWifiOnly: () => env.wifiOnly, subscribeOfflineSettings: () => () => undefined }));
vi.mock("../transferGate", () => ({
  wifiBlocked: (ctx: { wifiOnly: boolean; networkType: string; cellularAck: boolean }) =>
    ctx.wifiOnly && ctx.networkType === "cellular" && !ctx.cellularAck,
}));
vi.mock("./liveSurface", () => ({ platformLiveSurface: () => surface }));

const MB = 1_000_000;
function entry(id: number, status: string, over: Record<string, unknown> = {}) {
  return {
    id, itemId: `item${id}`, status, pausedByUser: false, phase: null, errorCode: null, nextRetryAt: null,
    bytesDone: 0, expectedSize: 100 * MB, title: `Titre ${id}`, seriesName: null, kind: "movie", indexNumber: null, ...over,
  };
}

const { recomputeLive, startLiveTransfers, stopLiveTransfers } = await import("./liveController");

beforeEach(() => {
  stopLiveTransfers();
  env.entries = [];
  env.progress.clear();
  env.wifiOnly = false;
  env.networkType = "wifi";
  env.offline = false;
  env.live = true;
  env.changed = [];
  env.appState = "active";
  env.appListeners = [];
  env.outcome = "shown";
  surface.show.mockClear();
  surface.end.mockClear();
  surface.holdTime.mockClear();
  surface.releaseTime.mockClear();
});

describe("suivi en direct des transferts", () => {
  it("un titre qui avance : l'activité démarre avec une fin estimée", () => {
    env.entries = [entry(1, "downloading")];
    env.progress.set(1, { bytesDone: 40 * MB, expectedSize: 100 * MB, rateBps: 2 * MB });
    startLiveTransfers("u1");
    expect(surface.show).toHaveBeenCalledTimes(1);
    const content = surface.show.mock.calls[0]![0];
    expect(content.phase).toBe("transferring");
    expect(content.endsAtMs).not.toBeNull();
    expect(content.single?.itemId).toBe("item1");
  });

  it("le Wi-Fi exigé en données mobiles : « En attente du Wi-Fi », sans fin estimée", () => {
    env.entries = [entry(1, "paused")];
    env.wifiOnly = true;
    env.networkType = "cellular";
    startLiveTransfers("u1");
    const [content, texts] = surface.show.mock.calls[0]!;
    expect(content.phase).toBe("waitingWifi");
    expect(content.endsAtMs).toBeNull();
    expect(texts.status).toBe("offline:liveWaitingWifi");
  });

  it("à la fin du lot, l'activité s'efface", () => {
    env.entries = [entry(1, "downloading")];
    startLiveTransfers("u1");
    env.entries = [entry(1, "complete", { bytesDone: 100 * MB })];
    for (const listener of env.changed) listener();
    expect(surface.end).toHaveBeenCalled();
  });

  it("rien à suivre au démarrage : une activité orpheline d'avant est effacée", () => {
    startLiveTransfers("u1");
    expect(surface.show).not.toHaveBeenCalled();
    expect(surface.end).toHaveBeenCalledTimes(1);
  });

  it("le réglage coupé efface l'activité en cours", () => {
    env.entries = [entry(1, "downloading")];
    startLiveTransfers("u1");
    env.live = false;
    recomputeLive();
    expect(surface.end).toHaveBeenCalled();
  });

  it("démarrage refusé (app déjà derrière) : reposée au retour au premier plan", async () => {
    env.appState = "background";
    env.outcome = "refused";
    env.entries = [entry(1, "downloading")];
    env.progress.set(1, { bytesDone: 40 * MB, expectedSize: 100 * MB, rateBps: 2 * MB });
    startLiveTransfers("u1");
    await settle();
    expect(surface.show).toHaveBeenCalledTimes(1);
    env.appState = "active";
    env.outcome = "shown";
    appStateChange("active");
    expect(surface.show).toHaveBeenCalledTimes(2);
    expect(surface.show.mock.calls[1]![0].phase).toBe("transferring");
  });

  it("passage derrière : l'état du moment est republié avant la suspension", async () => {
    env.entries = [entry(1, "downloading")];
    env.progress.set(1, { bytesDone: 40 * MB, expectedSize: 100 * MB, rateBps: 2 * MB });
    startLiveTransfers("u1");
    await settle();
    // 2 % de plus : sous le pas de 5 %, rien ne se republie de lui-même.
    env.progress.set(1, { bytesDone: 42 * MB, expectedSize: 100 * MB, rateBps: 2 * MB });
    recomputeLive();
    expect(surface.show).toHaveBeenCalledTimes(1);
    env.appState = "background";
    appStateChange("background");
    expect(surface.show).toHaveBeenCalledTimes(2);
    expect(surface.show.mock.calls[1]![0].percent).toBe(42);
  });

  it("refus au premier plan : retenté au fil des évènements, au plus toutes les 10 s", async () => {
    env.outcome = "refused";
    env.entries = [entry(1, "downloading")];
    env.progress.set(1, { bytesDone: 40 * MB, expectedSize: 100 * MB, rateBps: 2 * MB });
    startLiveTransfers("u1");
    await settle();
    const startedAt = Date.now();
    recomputeLive(startedAt + 2_000);
    expect(surface.show).toHaveBeenCalledTimes(1);
    env.outcome = "shown";
    recomputeLive(startedAt + 11_000);
    expect(surface.show).toHaveBeenCalledTimes(2);
    await settle();
    recomputeLive(startedAt + 30_000);
    expect(surface.show).toHaveBeenCalledTimes(2);
  });

  it("balayée de l'écran verrouillé : jamais reposée pour ce lot", async () => {
    env.outcome = "dismissed";
    env.entries = [entry(1, "downloading")];
    startLiveTransfers("u1");
    await settle();
    appStateChange("active");
    recomputeLive(Date.now() + 60_000);
    expect(surface.show).toHaveBeenCalledTimes(1);
  });
  it("derrière avant la première mesure : quelques secondes de plus, rendues dès qu'un temps restant est publié", async () => {
    vi.useFakeTimers();
    try {
      env.entries = [entry(1, "downloading")];
      startLiveTransfers("u1");
      expect(surface.show.mock.calls[0]![0].phase).toBe("estimating");
      env.appState = "background";
      appStateChange("background");
      expect(surface.holdTime).toHaveBeenCalledTimes(1);
      // Le débit arrive pendant ce délai : le temps restant part, puis la main est rendue.
      env.progress.set(1, { bytesDone: 10 * MB, expectedSize: 100 * MB, rateBps: 2 * MB });
      recomputeLive();
      expect(surface.show.mock.calls.at(-1)![0].phase).toBe("transferring");
      expect(surface.releaseTime).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(surface.releaseTime).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("derrière avec un temps restant déjà publié : rien à retenir", () => {
    env.entries = [entry(1, "downloading")];
    env.progress.set(1, { bytesDone: 40 * MB, expectedSize: 100 * MB, rateBps: 2 * MB });
    startLiveTransfers("u1");
    env.appState = "background";
    appStateChange("background");
    expect(surface.holdTime).not.toHaveBeenCalled();
  });

  it("retour au premier plan : le délai est rendu", async () => {
    vi.useFakeTimers();
    try {
      env.entries = [entry(1, "downloading")];
      startLiveTransfers("u1");
      env.appState = "background";
      appStateChange("background");
      env.appState = "active";
      appStateChange("active");
      await vi.advanceTimersByTimeAsync(2_000);
      expect(surface.releaseTime).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

/** Laisse répondre la surface (promesses du natif). */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function appStateChange(status: string): void {
  for (const listener of env.appListeners) listener(status);
}
