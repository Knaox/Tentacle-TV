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
}));
const surface = vi.hoisted(() => ({
  available: vi.fn(() => true),
  show: vi.fn((_content: LiveContent, _texts: { status: string }) => undefined),
  end: vi.fn(),
}));

vi.mock("@tentacle-tv/shared", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("@tentacle-tv/offline-core/react", () => ({ getProgressFor: (id: number) => env.progress.get(id) }));
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
  subscribeOfflineProgress: () => () => undefined,
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
  surface.show.mockClear();
  surface.end.mockClear();
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
});
