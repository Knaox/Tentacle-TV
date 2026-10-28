/**
 * La file du hors ligne en masse d'une extension (Sillon, 28/10) répond 503 + `Retry-After` tant qu'un titre
 * n'est pas prêt : le moteur revient à l'heure dite, sans compter d'échec — jamais l'échelle 5 s → 5 min.
 */

import { describe, expect, it, vi } from "vitest";
import { openInMemory } from "../node/nodeDatabase";
import { enqueueMusicBatch } from "./musicKeep";
import { listMusicForUser } from "./musicLibrary";
import { NetworkRetryLadder } from "./networkRetry";
import { getFile } from "./queue";
import { serverWaitMs } from "./retryAfter";
import type { TransferNet, TransferStream } from "./transferNet";
import { CREDS, makeEngine, preparedRoot } from "./testkit";

const header = (value: string | null) => (name: string) => (name === "retry-after" ? value : null);

describe("serverWaitMs", () => {
  it("un 503 avec des secondes, ou une date HTTP", () => {
    expect(serverWaitMs(503, header("120"), 0)).toBe(120_000);
    expect(serverWaitMs(503, header(new Date(90_000).toUTCString()), 30_000)).toBe(60_000);
  });

  it("borné : au moins une seconde, au plus six heures", () => {
    expect(serverWaitMs(503, header("0"), 0)).toBe(1_000);
    expect(serverWaitMs(503, header("999999"), 0)).toBe(6 * 3_600_000);
  });

  it("rien à dire : pas un 503, pas d'en-tête, ou illisible", () => {
    expect(serverWaitMs(502, header("120"), 0)).toBeUndefined();
    expect(serverWaitMs(503, header(null), 0)).toBeUndefined();
    expect(serverWaitMs(503, header("bientôt"), 0)).toBeUndefined();
  });
});

describe("l'échelle des relances face à un serveur qui prépare", () => {
  const failed = (retryAfterMs?: number) => ({ kind: "failed" as const, code: "network" as const, bytesDone: 0, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) });
  const opts = (nowMs: number) => ({ moved: false, systemSuspended: false, nowMs });

  it("l'heure dite, sans monter d'une marche : la vraie coupure suivante repart de la première", () => {
    const ladder = new NetworkRetryLadder([10, 40, 90]);
    expect(ladder.dueAt(1, failed(), opts(0))).toBe(10);
    expect(ladder.dueAt(1, failed(), opts(0))).toBe(40);
    expect(ladder.dueAt(1, failed(120_000), opts(1_000))).toBe(121_000);
    expect(ladder.dueAt(1, failed(), opts(0))).toBe(10);
  });

  it("jamais une relance immédiate (iPhone derrière) quand le serveur a dit quand revenir", () => {
    const ladder = new NetworkRetryLadder([10], () => 3);
    expect(ladder.dueAt(1, failed(60_000), opts(0))).toBe(60_000);
  });
});

/** La file de l'extension : 503 + Retry-After tant que le titre n'est pas prêt, puis le fichier. */
function pacedNet(readyAfter: number): { net: TransferNet; opened: () => number } {
  let opened = 0;
  const net: TransferNet = {
    async open(): Promise<TransferStream> {
      opened += 1;
      if (opened <= readyAfter) {
        return { status: 503, header: header("1800"), chunks: (async function* () {})() };
      }
      return { status: 200, header: (n) => (n === "content-length" ? "3" : null), chunks: (async function* () { yield new Uint8Array([1, 2, 3]); })() };
    },
    async killTranscode() {
      /* rien */
    },
  };
  return { net, opened: () => opened };
}

describe("le moteur et la file du serveur", () => {
  it("503 + Retry-After : en attente jusqu'à l'heure dite (dite à la page), puis gardé", async () => {
    const db = openInMemory();
    let clock = 1_000;
    const server = pacedNet(2);
    const { engine } = makeEngine(db, preparedRoot(), server.net, { now: () => clock, networkRetryDelaysMs: [5_000, 300_000] });
    const fileId = enqueueMusicBatch(db, "u", [{
      trackKey: "ext:sillon:ytm:t:x", origin: "external", sourcePath: "/api/plugins/sillon/music/offline/x", variant: "original", preset: null,
      containerExt: "audio", expectedSize: null, estimatedSize: 3, title: "T", artist: null, album: null, albumKey: null, discNumber: null,
      trackNumber: null, durationMs: 1_000, artworkPath: null, trackJson: "{}",
    }], 1e12, 1_000).fileIds[0]!;

    engine.start(CREDS);
    await vi.waitFor(() => expect(getFile(db, fileId)?.nextRetryAt).toBe(1_000 + 1_800_000));
    expect(getFile(db, fileId)).toMatchObject({ status: "paused", retryCount: 0 });
    expect(listMusicForUser(db, "u")[0]).toMatchObject({ preparing: true, retryAt: 1_801_000 });

    // Avant l'heure : rien ne repart.
    clock = 1_000_000;
    engine.sweepRetries();
    expect(server.opened()).toBe(1);

    clock = 1_801_000;
    engine.sweepRetries();
    // Second 503 : toujours l'heure dite, jamais la marche suivante de l'échelle.
    await vi.waitFor(() => expect(getFile(db, fileId)?.nextRetryAt).toBe(1_801_000 + 1_800_000));
    clock = 3_601_000;
    engine.sweepRetries();
    await vi.waitFor(() => expect(getFile(db, fileId)?.status).toBe("complete"));
    expect(server.opened()).toBe(3);
  });
});
