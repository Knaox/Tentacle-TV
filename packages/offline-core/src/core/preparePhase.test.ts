/**
 * « Préparation… » : la phase qu'un titre de musique porte tant que le serveur
 * le prépare (aucune réponse, ou un 503), distincte du transfert. Un film n'en
 * a jamais — le mobile n'en voit rien.
 */

import { describe, expect, it } from "vitest";
import { openInMemory } from "../node/nodeDatabase";
import { enqueueMusicBatch, type MusicKeepItem } from "./musicKeep";
import { listMusicForUser } from "./musicLibrary";
import { PREPARE_PHASE } from "./preparePhase";
import { getFile } from "./queue";
import type { TransferNet, TransferStream } from "./transferNet";
import { CREDS, makeEngine, preparedRoot, seed } from "./testkit";

const EXTERNAL: MusicKeepItem = {
  trackKey: "ext:sillon:ytm:t:dQw4w9WgXcQ",
  origin: "external",
  sourcePath: "/api/plugins/sillon/music/offline/ytm%3At%3AdQw4w9WgXcQ",
  variant: "original",
  preset: null,
  containerExt: "audio",
  expectedSize: null,
  estimatedSize: 5_000,
  title: "Titre",
  artist: null,
  album: null,
  albumKey: null,
  discNumber: null,
  trackNumber: null,
  durationMs: 20_000,
  artworkPath: null,
  trackJson: "{}",
};

/** Un serveur qui répond quand on le lui dit, avec le statut voulu. */
function answeringNet(): { net: TransferNet; answer: (status: number, body?: string) => void; opened: () => number } {
  let opened = 0;
  let reply: ((stream: TransferStream) => void) | null = null;
  const net: TransferNet = {
    open: () => {
      opened += 1;
      return new Promise<TransferStream>((resolve) => {
        reply = resolve;
      });
    },
    async killTranscode() {
      /* rien */
    },
  };
  const answer = (status: number, body = "abc") =>
    reply?.({
      status,
      header: (name) => (name === "content-length" ? String(body.length) : null),
      chunks: (async function* () {
        if (status < 400) yield new Uint8Array(Buffer.from(body));
      })(),
    });
  return { net, answer, opened: () => opened };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

function keepOne(db: ReturnType<typeof openInMemory>): number {
  const outcome = enqueueMusicBatch(db, "u", [EXTERNAL], 1e12, 1_000);
  return outcome.fileIds[0]!;
}

describe("la préparation d'un titre de musique", () => {
  it("dite pendant l'attente de la réponse, puis le transfert, puis gardé", async () => {
    const db = openInMemory();
    const server = answeringNet();
    const { engine, events } = makeEngine(db, preparedRoot(), server.net);
    const fileId = keepOne(db);
    engine.start(CREDS);
    await flush();
    expect(server.opened()).toBe(1);
    expect(getFile(db, fileId)?.phase).toBe(PREPARE_PHASE);
    expect(listMusicForUser(db, "u")[0]).toMatchObject({ status: "downloading", preparing: true });

    const before = events.filter((e) => e === "downloads://changed").length;
    server.answer(200, "abcdef");
    await flush();
    const row = listMusicForUser(db, "u")[0];
    expect(row).toMatchObject({ status: "complete", preparing: false, expectedSize: 6, bytesDone: 6 });
    // La page relit à l'arrivée de la réponse : elle quitte « Préparation… » sans attendre la fin.
    expect(events.filter((e) => e === "downloads://changed").length).toBeGreaterThanOrEqual(before + 2);
  });

  it("un 503 (le serveur prépare encore) : pause système, la préparation reste dite", async () => {
    const db = openInMemory();
    const server = answeringNet();
    const { engine } = makeEngine(db, preparedRoot(), server.net);
    const fileId = keepOne(db);
    engine.start(CREDS);
    await flush();
    server.answer(503);
    await flush();
    expect(getFile(db, fileId)).toMatchObject({ status: "paused", phase: PREPARE_PHASE });
    expect(listMusicForUser(db, "u")[0]?.pausedByUser).toBe(false);
    expect(listMusicForUser(db, "u")[0]?.preparing).toBe(true);
  });

  it("une autre fin (introuvable, coupure, pause) efface la préparation", async () => {
    for (const end of ["404", "throw", "pause"] as const) {
      const db = openInMemory();
      const server = answeringNet();
      const net: TransferNet =
        end === "throw" ? { open: () => Promise.reject(new Error("réseau")), killTranscode: async () => undefined } : server.net;
      const { engine } = makeEngine(db, preparedRoot(), net);
      const fileId = keepOne(db);
      engine.start(CREDS);
      await flush();
      if (end === "404") server.answer(404);
      if (end === "pause") {
        engine.pause(fileId);
        server.answer(200);
      }
      await flush();
      expect(getFile(db, fileId)?.phase, end).toBeNull();
    }
  });

  it("un film n'a jamais de préparation (le mobile n'en voit rien)", async () => {
    const db = openInMemory();
    const server = answeringNet();
    const root = preparedRoot();
    const { engine } = makeEngine(db, root, server.net);
    const fileId = seed(db, "item1", 1_000);
    engine.start(CREDS);
    await flush();
    expect(getFile(db, fileId)).toMatchObject({ status: "downloading", phase: null });
    server.answer(503);
    await flush();
    expect(getFile(db, fileId)?.phase).toBeNull();
  });
});
