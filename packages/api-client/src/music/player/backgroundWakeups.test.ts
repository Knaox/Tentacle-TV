/**
 * Banc en horloge simulée : app derrière, Octave en lecture d'un titre de la
 * bibliothèque — combien de SECONDES distinctes par minute le client touche-t-il
 * le réseau (ping du socket + rapport d'écoute) ? Chaque seconde avec trafic
 * réveille le modem ; en 4G/5G, il ne se rendort qu'après une dizaine de
 * secondes de silence. (Le ping du serveur et la sonde de connectivité ont
 * leurs bancs : `apps/backend/src/routes/wsKeepalive.test.ts`,
 * `apps/mobile/src/offline/probeQuiet.test.ts`.)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackReporter } from "@tentacle-tv/shared/octave";
import { libraryTrack } from "@tentacle-tv/shared/octave/testing";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  static traffic: number[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(): void {
    FakeWebSocket.traffic.push(Date.now());
  }
  close(): void {
    this.readyState = 3;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  FakeWebSocket.instances = [];
  FakeWebSocket.traffic = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** 10 min derrière, le moteur donnant sa position toutes les `engineTickMs` ; secondes avec trafic, par minute (régime établi). */
async function wakeupsPerMinute(paced: boolean, engineTickMs: number): Promise<number[]> {
  const socket = await import("../../socket/tentacleSocket");
  const { socketReportPacing } = await import("./socketReportPacing");
  socket.setWsBackendUrl("http://backend.test");
  const release = socket.acquireSocket("jeton");
  const ws = FakeWebSocket.instances[0];
  ws.readyState = FakeWebSocket.OPEN;
  ws.onopen?.();
  const pacing = socketReportPacing(() => true);
  const reporter = new PlaybackReporter({
    library: () => FakeWebSocket.traffic.push(Date.now()),
    externalPlayed: () => undefined,
    now: () => Date.now(),
    ...(paced ? { background: pacing.pacing.background } : {}),
  });
  if (paced) pacing.pacing.onBeat?.(() => reporter.beat());
  // Le titre démarre décalé du socket (ouvert au lancement de l'app) : dans la vraie vie, rien ne les aligne.
  vi.advanceTimersByTime(7_300);
  reporter.started(libraryTrack("t1"), 0);
  let position = 0;
  const engine = setInterval(() => reporter.progress((position += engineTickMs)), engineTickMs);
  vi.advanceTimersByTime(10 * 60_000);
  clearInterval(engine);
  pacing.dispose();
  release();
  const seconds = new Set(FakeWebSocket.traffic.map((t) => Math.floor(t / 1000)));
  // Minutes 2 à 9 : le régime établi (ni l'ouverture, ni la dernière minute entamée).
  return [2, 3, 4, 5, 6, 7, 8, 9].map((m) => [...seconds].filter((s) => s >= m * 60 && s < (m + 1) * 60).length);
}

describe("app derrière : réveils réseau du client par minute", () => {
  it("avant : ping du socket (2) + progression toutes les 15 s (4) = 6 réveils par minute", async () => {
    expect(await wakeupsPerMinute(false, 250)).toEqual([6, 6, 6, 6, 6, 6, 6, 6]);
  });

  it("après : la progression part avec le ping — 2 réveils par minute, moteur à 4 nouvelles/s", async () => {
    expect(Math.max(...(await wakeupsPerMinute(true, 250)))).toBeLessThanOrEqual(2);
  });

  it("après : 2 réveils par minute aussi quand le natif n'envoie plus sa position que toutes les 5 s", async () => {
    expect(Math.max(...(await wakeupsPerMinute(true, 5_000)))).toBeLessThanOrEqual(2);
  });
});
